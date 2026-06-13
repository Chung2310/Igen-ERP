import React, { useState, useRef, useEffect } from 'react';
import { useProgress } from '../../hooks/use-progress';
import { geminiApi } from '../../api/gemini';
import { elevenlabsApi } from '../../api/elevenlabs';
import { toast } from '../../pages/Toast';
import {
   Loader2, Mic, Play, Download, Volume2, Pause, Wand2,
   Trash2, Clock, MicOff, Headphones, Library, Settings2,
   Check, Search, ChevronRight, X, Sparkles, Diamond, Shuffle,
   Upload, ChevronLeft, ArrowLeft, Plus, VolumeX, AlertCircle,
   FileAudio, Laptop, RefreshCw, BookOpen, Volume1
} from 'lucide-react';
import { estimateAudioDuration } from '../../utils/usage-tracker';

const VOICE_STYLE_TEMPLATES = [
   { id: 'none', label: 'TÃ¹y chá»‰nh (Tá»± nháº­p)', prompt: '' },
   { id: 'news', label: 'ðŸŽ™ï¸ BTV thá»i sá»±', prompt: 'Äá»c dÃµng dáº¡c, nghiÃªm tÃºc, rÃµ rÃ ng vÃ  máº¡ch láº¡c nhÆ° má»™t biÃªn táº­p viÃªn truyá»n hÃ¬nh.' },
   { id: 'story', label: 'ðŸŒ™ Ká»ƒ chuyá»‡n', prompt: 'Äá»c cháº­m rÃ£i, áº¥m Ã¡p, truyá»n cáº£m nhÆ° Ä‘ang ká»ƒ chuyá»‡n cho tráº» em nghe.' },
   { id: 'excited', label: 'ðŸŽ‰ HÃ o há»©ng', prompt: 'Äá»c tháº­t hÃ o há»©ng, bÃ¹ng ná»•, vui tÆ°Æ¡i vÃ  trÃ n diá»‡n nhiá»‡t huyáº¿t.' },
   { id: 'prof', label: 'ðŸ“Š ChuyÃªn gia', prompt: 'Äá»c Ä‘iá»m Ä‘áº¡m, tá»‘c Ä‘á»™ vá»«a pháº£i, chuyÃªn nghiá»‡p vÃ  Ä‘áº§y tÃ­nh thuyáº¿t phá»¥c.' },
   { id: 'sad', label: 'ðŸ¥€ SÃ¢u láº¯ng', prompt: 'Äá»c vá»›i giá»ng tráº§m buá»“n, ngháº¹n ngÃ o, tá»‘c Ä‘á»™ cháº­m rÃ£i thá»ƒ hiá»‡n sá»± Ä‘á»“ng cáº£m.' },
   { id: 'urgent', label: 'ðŸš¨ Kháº©n cáº¥p', prompt: 'Äá»c dá»©t khoÃ¡t, nhanh, Ã¢m lÆ°á»£ng lá»›n vÃ  táº­p trung vÃ o sá»± quan trá»ng cá»§a thÃ´ng tin.' },
];

const ALL_VOICES = [
   { id: 'Aoede', gender: 'female', age: 'young', label: 'CÃ´ gÃ¡i (~25t)', description: 'Nháº¹ nhÃ ng, truyá»n cáº£m (Bella)' },
   { id: 'Kore', gender: 'female', age: 'child', label: 'BÃ© gÃ¡i (~12t)', description: 'Trong tráº»o, dá»… thÆ°Æ¡ng (Rachel)' },
   { id: 'Puck', gender: 'male', age: 'child', label: 'BÃ© trai (~12t)', description: 'NÄƒng Ä‘á»™ng, hoáº¡t bÃ¡t (Josh)' },
   { id: 'Charon', gender: 'male', age: 'adult', label: 'ÄÃ n Ã´ng (~45t)', description: 'Tráº§m áº¥m, máº¡nh máº½ (Charlie)' },
   { id: 'Fenrir', gender: 'male', age: 'young', label: 'ChÃ ng trai (~25t)', description: 'Sáº¯c sáº£o, rÃµ rÃ ng (Arnold)' },
   { id: 'Leda', gender: 'female', age: 'young', label: 'Thanh niÃªn', description: 'Trong tráº»o, tá»± nhiÃªn (Emily)' },
   { id: 'Orus', gender: 'male', age: 'adult', label: 'Trung niÃªn', description: 'Tráº§m áº¥m, vang (George)' },
   { id: 'Callirrhoe', gender: 'female', age: 'adult', label: 'Trung niÃªn', description: 'Má»m máº¡i, áº¥m Ã¡p (Domi)' },
   { id: 'Autonoe', gender: 'female', age: 'young', label: 'Thanh niÃªn', description: 'Thanh thoÃ¡t, rÃµ lá»i (Ellie)' },
   { id: 'Enceladus', gender: 'male', age: 'young', label: 'Thanh niÃªn', description: 'Máº¡nh máº½, dá»©t khoÃ¡t (Callum)' },
   { id: 'Iapetus', gender: 'male', age: 'adult', label: 'Trung niÃªn', description: 'SÃ¢u tráº§m, chá»¯ng cháº¡c (Patrick)' },
   { id: 'Umbriel', gender: 'male', age: 'young', label: 'Thanh niÃªn', description: 'Nháº¹ nhÃ ng, tá»« tá»‘n (Harry)' },
   { id: 'Algieba', gender: 'female', age: 'adult', label: 'Trung niÃªn', description: 'DÃ y, sang trá»ng (Dorothy)' },
   { id: 'Despina', gender: 'female', age: 'young', label: 'Thanh niÃªn', description: 'Cao, nhÃ­ nháº£nh (Mimi)' },
   { id: 'Sadaltager', gender: 'male', age: 'adult', label: 'Trung niÃªn', description: 'Tráº§m áº¥m, Ä‘á»™c Ä‘Ã¡o (Adam)' }
];

const DEFAULT_FALLBACK_VOICE_ID = '';

const MODEL_OPTIONS = [
   {
      key: 'eleven_flash_v2_5',
      modelId: 'eleven_flash_v2_5',
      title: 'Eleven Flash v2.5',
      description: 'MÃ´ hÃ¬nh Ä‘á»™ trá»… cá»±c tháº¥p, tá»‘i Æ°u cho há»™i thoáº¡i nhanh.',
      badges: ['Low Latency', 'Flash'],
   },
   {
      key: 'eleven_turbo_v2_5',
      modelId: 'eleven_turbo_v2_5',
      title: 'Eleven Turbo v2.5',
      description: 'MÃ´ hÃ¬nh tá»‘c Ä‘á»™ nhanh, tá»‘i Æ°u chi phÃ­ phÃ¡t sinh.',
      badges: ['Fast', 'Turbo'],
   },
] as const;

const getActiveModelId = (voiceModel: 'eleven_flash_v2_5' | 'eleven_turbo_v2_5') => {
   return voiceModel;
};

function getModelDetails(modelId: string, availableModels: any[]) {
   const apiModel = availableModels.find((model: any) => model.model_id === modelId);
   const languages =
      apiModel?.supported_languages ||
      apiModel?.languages ||
      apiModel?.language_support ||
      [];

   const languageNames = Array.isArray(languages)
      ? languages
         .map((item: any) => (typeof item === 'string' ? item : item?.name || item?.language || item?.language_name))
         .filter(Boolean)
      : [];

   return {
      apiModel,
      languageNames,
      languageSummary:
         languageNames.length > 0
            ? languageNames.slice(0, 8).join(', ')
            : 'Chua co metadata ngon ngu tu ElevenLabs API',
   };
}

const TapeIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
   <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="12" r="3.5" />
      <circle cx="17.5" cy="12" r="3.5" />
      <line x1="6.5" y1="15.5" x2="17.5" y2="15.5" />
      <line x1="6.5" y1="8.5" x2="17.5" y2="8.5" />
   </svg>
);

// Removed heavy client-side WAV encoder function audioBufferToWav to optimize memory and CPU usage.

export function VoiceGenerationWorkspace() {
   const [text, setText] = useState('');

   // Custom states
   const [customStyleInstructions, setCustomStyleInstructions] = useState('');
   const [selectedStylePrompt, setSelectedStylePrompt] = useState('');
   const [selectedRegionPrompt, setSelectedRegionPrompt] = useState('');
   const [mode, setMode] = useState<'single' | 'multi'>('single');
   const [temperature, setTemperature] = useState(1.0);

   // Archive Metadata (Optional fields from mockup)
   const [archiveTitle, setArchiveTitle] = useState('');
   const [archiveDescription, setArchiveDescription] = useState('');

   // Voice selection states
   const [voiceId, setVoiceId] = useState(DEFAULT_FALLBACK_VOICE_ID);
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

   // ElevenLabs custom states
   const [availableVoices, setAvailableVoices] = useState<any[]>([]);
   const [availableModels, setAvailableModels] = useState<any[]>([]);
   const [stability, setStability] = useState<number>(0.50);
   const [similarityBoost, setSimilarityBoost] = useState<number>(0.75);
   const [useSpeakerBoost, setUseSpeakerBoost] = useState<boolean>(true);
   const [useLanguageToggle, setUseLanguageToggle] = useState<boolean>(true);
   const [voiceModel, setVoiceModel] = useState<'eleven_flash_v2_5' | 'eleven_turbo_v2_5'>('eleven_turbo_v2_5');

   // Modals state
   const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
   const [isVoicePickerView, setIsVoicePickerView] = useState(false);
   const [isVoiceLibraryHoverOpen, setIsVoiceLibraryHoverOpen] = useState(false);
   const [voiceActiveTab, setVoiceActiveTab] = useState<'my-voices' | 'library'>('my-voices');
   const [searchQuery, setSearchQuery] = useState('');
   const [isSavingVoiceSettings, setIsSavingVoiceSettings] = useState(false);

   // Clone/Create Voice modal states
   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
   const [createStep, setCreateStep] = useState<'selection' | 'upload' | 'info' | 'finish' | 'design'>('selection');
   const [creationMode, setCreationMode] = useState<'design' | 'instant' | 'professional' | 'remix' | null>(null);

   // Instant voice cloning states
   const [instantFiles, setInstantFiles] = useState<any[]>([]);
   const [isRecordingClone, setIsRecordingClone] = useState(false);
   const [recordingDuration, setRecordingDuration] = useState(0);
   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
   const audioChunksRef = useRef<Blob[]>([]);
   const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
   const cloneAudioElementRef = useRef<HTMLAudioElement | null>(null);
   const [playingFileIndex, setPlayingFileIndex] = useState<number | null>(null);

   // Voice design states (Thiáº¿t káº¿ giá»ng nÃ³i)
   const [designGender, setDesignGender] = useState<'male' | 'female'>('female');
   const [designAge, setDesignAge] = useState<'young' | 'middle_aged' | 'old'>('young');
   const [designAccent, setDesignAccent] = useState<string>('american');
   const [designAccentStrength, setDesignAccentStrength] = useState<number>(1.0);
   const [designText, setDesignText] = useState<string>('Xin chÃ o! ÄÃ¢y lÃ  báº£n nghe thá»­ giá»ng nÃ³i má»›i thiáº¿t káº¿ cá»§a báº¡n.');
   const [isGeneratingDesignPreview, setIsGeneratingDesignPreview] = useState(false);
   const [designPreviewVoiceId, setDesignPreviewVoiceId] = useState<string | null>(null);
   const [designPreviewUrl, setDesignPreviewUrl] = useState<string | null>(null);

   // Save voice details
   const [newVoiceName, setNewVoiceName] = useState('');
   const [newVoiceDescription, setNewVoiceDescription] = useState('');
   const [isSavingVoice, setIsSavingVoice] = useState(false);

   // Auto-calculated styleInstructions
   const styleInstructions = [
      selectedStylePrompt,
      selectedRegionPrompt,
      customStyleInstructions
   ].filter(Boolean).join(', ');

   useEffect(() => {
      loadHistory();
      loadCustomVoices();
      loadModels();
      // Cleanup speech recognition and audios on unmount
      return () => {
         if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
         }
         if (previewAudioRef.current) previewAudioRef.current.pause();
         if (audioRef.current) audioRef.current.pause();
         if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };
   }, []);

   useEffect(() => {
      if (!voiceId) return;
      loadVoiceSettings(voiceId);
   }, [voiceId]);

   const loadHistory = async () => {
      try {
         setIsLoadingHistory(true);
         const data = await elevenlabsApi.getVoiceHistory();
         setHistory(data.history || []);
      } catch (e: any) {
         toast.error(`Lá»—i Ä‘á»“ng bá»™ lá»‹ch sá»­: ${e.message}`);
      } finally {
         setIsLoadingHistory(false);
      }
   };

   const loadCustomVoices = async () => {
      try {
         const response = await elevenlabsApi.getVoices();
         if (response && response.voices) {
            const mappedVoices = response.voices.map((voice: any) => ({
               ...voice,
               id: voice.voice_id,
               label: voice.name || 'ElevenLabs Voice',
               gender: voice.labels?.gender || 'female',
               description: voice.description || voice.category || 'ElevenLabs voice',
            }));
            setAvailableVoices(mappedVoices);
            setVoiceId((currentVoiceId) => {
               const hasCurrentVoice = mappedVoices.some((voice: any) => voice.voice_id === currentVoiceId);
               if (hasCurrentVoice) return currentVoiceId;
               return mappedVoices[0]?.voice_id || currentVoiceId;
            });
         }
      } catch (e) {
         console.error("Lá»—i láº¥y danh sÃ¡ch giá»ng nÃ³i cÃ¡ nhÃ¢n:", e);
      }
   };

   const loadModels = async () => {
      try {
         const response = await elevenlabsApi.getModels();
         if (response && response.models) {
            setAvailableModels(response.models);
         }
      } catch (e) {
         console.error("Loi lay danh sach model ElevenLabs:", e);
      }
   };

   const loadVoiceSettings = async (targetVoiceId: string) => {
      if (!targetVoiceId) return;
      try {
         const settings = await elevenlabsApi.getVoiceSettings(targetVoiceId);
         if (typeof settings?.stability === 'number') {
            setStability(settings.stability);
         }
         if (typeof settings?.similarity_boost === 'number') {
            setSimilarityBoost(settings.similarity_boost);
         }
         if (typeof settings?.use_speaker_boost === 'boolean') {
            setUseSpeakerBoost(settings.use_speaker_boost);
         }
      } catch (e) {
         console.error('Loi lay voice settings ElevenLabs:', e);
         setStability(0.5);
         setSimilarityBoost(0.75);
         setUseSpeakerBoost(true);
      }
   };

   const getVoiceDetails = (id: string) => {
      const standardVoice = availableVoices.find(v => v.voice_id === id);
      if (standardVoice) {
         return {
            id: standardVoice.voice_id,
            label: standardVoice.name || 'ElevenLabs Voice',
            gender: standardVoice.labels?.gender || 'female',
            description: standardVoice.description || standardVoice.category || 'ElevenLabs voice',
            tags: `${standardVoice.gender === 'male' ? 'Nam' : 'Ná»¯'} â€¢ ${standardVoice.description}`
         };
      }
      const customVoice = availableVoices.find(v => v.voice_id === id);
      if (customVoice) {
         return {
            id: customVoice.voice_id,
            label: customVoice.name,
            gender: customVoice.labels?.gender || 'female',
            description: customVoice.description || 'Giá»ng Ä‘Ã£ nhÃ¢n báº£n',
            tags: `${customVoice.labels?.gender === 'male' ? 'Nam' : 'Ná»¯'} â€¢ Giá»ng cÃ¡ nhÃ¢n`
         };
      }
      return {
         id: availableVoices[0]?.voice_id || '',
         label: availableVoices[0]?.name || 'ElevenLabs Voice',
         gender: availableVoices[0]?.labels?.gender || 'male',
         description: availableVoices[0]?.description || 'Default ElevenLabs voice',
         tags: 'Nam â€¢ iGen Audio v3'
      };
   };

   const getSelectedVoice = () => {
      return getVoiceDetails(voiceId);
   };

   const playPreviewAudio = (url: string) => {
      if (previewAudioRef.current) {
         previewAudioRef.current.pause();
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.play();
   };

   const handlePreviewVoice = async (id?: string) => {
      const targetId = id || voiceId;
      const currentVoice = getVoiceDetails(targetId);

      // Check cache
      if (previewCache[targetId]) {
         playPreviewAudio(previewCache[targetId]);
         return;
      }

      setIsPreviewing(true);
      try {
         const previewText = currentVoice.gender === 'female'
            ? `Xin chÃ o, Ä‘Ã¢y lÃ  giá»ng nÃ³i cá»§a tÃ´i. Ráº¥t vui Ä‘Æ°á»£c gáº·p báº¡n.`
            : `Xin chÃ o, Ä‘Ã¢y lÃ  giá»ng nÃ³i cá»§a tÃ´i. ChÃºc báº¡n má»™t ngÃ y tá»‘t lÃ nh.`;

         const result = await elevenlabsApi.generateVoice({
            textToSpeak: previewText,
            mode: 'single',
            temperature: 1.0,
            speakerA: 'Aoede',
            speakerB: 'Puck',
            modelName: 'eleven_multilingual_v2',
            voiceName: targetId,
            saveToHistory: false,
         });

         const previewUrl = result.url || result.record?.url;
         if (previewUrl) {
            setPreviewCache(prev => ({ ...prev, [targetId]: previewUrl }));
            playPreviewAudio(previewUrl);
         }
      } catch (e: any) {
         toast.error(`Lá»—i phÃ¡t thá»­: ${e.message}`);
      } finally {
         setIsPreviewing(false);
      }
   };

   // Speech to text integration
   const toggleDictation = () => {
      if (isListening) {
         if (recognitionRef.current) {
            recognitionRef.current.stop();
         }
         setIsListening(false);
         return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
         toast.warning('TrÃ¬nh duyá»‡t cá»§a báº¡n khÃ´ng há»— trá»£ nháº­n diá»‡n giá»ng nÃ³i (Speech Recognition).');
         return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'vi-VN';
      recognitionRef.current = recognition;

      const startText = text;

      recognition.onstart = () => {
         setIsListening(true);
         toast.success('Äang láº¯ng nghe... HÃ£y nÃ³i vÃ o Microphone.');
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
         toast.warning('Vui lÃ²ng nháº­p ká»‹ch báº£n cáº§n tá»‘i Æ°u.');
         return;
      }
      setIsOptimizing(true);
      try {
         toast.success('AI Ä‘ang tá»‘i Æ°u hÃ³a ká»‹ch báº£n...');
         const result = await geminiApi.optimizeScript(text, styleInstructions || 'háº¥p dáº«n, lÃ´i cuá»‘n');
         if (result.optimizedText) {
            setText(result.optimizedText);
            toast.success('Tá»‘i Æ°u hÃ³a ká»‹ch báº£n thÃ nh cÃ´ng!');
         }
      } catch (error: any) {
         toast.error(`Lá»—i: ${error.message}`);
      } finally {
         setIsOptimizing(false);
      }
   };

   const handleGenerate = async () => {
      if (!text.trim()) {
         toast.warning('Vui lÃ²ng nháº­p vÄƒn báº£n cáº§n Ä‘á»c.');
         return;
      }

      setIsGenerating(true);
      setAudioUri(null);
      setIsPlaying(false);

      try {
         toast.success('Äang báº¯t Ä‘áº§u táº¡o giá»ng nÃ³i AI...');

         // Map frontend model name to actual ElevenLabs model ID
         const modelId = voiceModel;

         const result = await elevenlabsApi.generateVoice({
            textToSpeak: text,
            styleInstructions,
            mode,
            temperature,
            modelName: modelId,
            voiceName: voiceId,
            speakerA,
            speakerB,
            title: archiveTitle.trim() || undefined,
            description: archiveDescription.trim() || undefined,
            stability: stability,
            similarityBoost: similarityBoost,
            useSpeakerBoost: useSpeakerBoost,
         });

         if (result.record?.url) {
            setAudioUri(result.record.url);
            toast.success('Táº¡o giá»ng nÃ³i thÃ nh cÃ´ng!');
            setArchiveTitle('');
            setArchiveDescription('');
            loadHistory(); // Reload history
         }
      } catch (error: any) {
         console.error(error);
         toast.error(`Lá»—i sinh giá»ng nÃ³i: ${error.message}`);
      } finally {
         setIsGenerating(false);
      }
   };

   const handleDeleteHistory = async (id: string) => {
      if (!confirm("Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a báº£n thu Ã¢m nÃ y?")) return;
      try {
         await elevenlabsApi.deleteVoiceHistory(id);
         toast.success('ÄÃ£ xÃ³a báº£n thu Ã¢m khá»i lá»‹ch sá»­.');
         setHistory(prev => prev.filter(r => r._id !== id && r.id !== id));
      } catch (e: any) {
         toast.error(`Lá»—i khi xÃ³a: ${e.message}`);
         loadHistory();
      }
   };

   const handleDeleteCustomVoice = async (e: React.MouseEvent, voiceIdToDelete: string) => {
      e.stopPropagation();
      if (!confirm("Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a giá»ng nÃ³i nhÃ¢n báº£n nÃ y?")) return;
      try {
         await elevenlabsApi.deleteVoice(voiceIdToDelete);
         toast.success('ÄÃ£ xÃ³a giá»ng nÃ³i thÃ nh cÃ´ng.');
         if (voiceId === voiceIdToDelete) {
            setVoiceId(availableVoices.find(v => v.voice_id !== voiceIdToDelete)?.voice_id || '');
         }
         loadCustomVoices();
      } catch (e: any) {
         toast.error(`Lá»—i khi xÃ³a giá»ng nÃ³i: ${e.message}`);
      }
   };

   const handleSaveVoiceSettings = async () => {
      try {
         setIsSavingVoiceSettings(true);
         await elevenlabsApi.updateVoiceSettings(voiceId, {
            stability,
            similarity_boost: similarityBoost,
            use_speaker_boost: useSpeakerBoost,
         });
         toast.success('Da luu voice settings len ElevenLabs.');
      } catch (e: any) {
         toast.error(`Khong the luu voice settings: ${e.message}`);
      } finally {
         setIsSavingVoiceSettings(false);
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

   // Instant cloning wizard helper
   const processCloneFile = async (file: File) => {
      if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
         toast.error('Vui l\u00f2ng t\u1ea3i l\u00ean \u0111\u1ecbnh d\u1ea1ng file \u00e2m thanh ho\u1eb7c video!');
         return;
      }
      try {
         // Get audio duration using HTML5 Audio
         const getDuration = (): Promise<number> => {
            return new Promise((resolve) => {
               const audio = new Audio();
               audio.src = URL.createObjectURL(file);
               audio.addEventListener('loadedmetadata', () => {
                  resolve(audio.duration);
                  URL.revokeObjectURL(audio.src);
               });
               audio.addEventListener('error', () => {
                  resolve(0);
               });
            });
         };

         const duration = await getDuration();

         const reader = new FileReader();
         reader.readAsDataURL(file);
         reader.onload = () => {
            const base64Data = reader.result as string;
            setInstantFiles(prev => [...prev, {
               file: base64Data,
               name: file.name,
               size: file.size,
               duration: duration
            }]);
         };
      } catch (err: any) {
         console.error("L\u1ed7i x\u1eed l\u00fd file \u00e2m thanh:", err);
         toast.error(`Kh\u00f4ng th\u1ec3 x\u1eed l\u00fd file \u00e2m thanh: ${err.message || err}`);
      }
   };

   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
         Array.from(e.target.files).forEach((file: any) => {
            processCloneFile(file);
         });
      }
   };

   const handleStartRecordingClone = async () => {
      try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         const mediaRecorder = new MediaRecorder(stream);
         mediaRecorderRef.current = mediaRecorder;
         audioChunksRef.current = [];

         mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
         };

         mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const file = new File([blob], `ghi-am-${Date.now()}.webm`, { type: 'audio/webm' });
            processCloneFile(file);
         };

         mediaRecorder.start();
         setIsRecordingClone(true);
         setRecordingDuration(0);
         recordingTimerRef.current = setInterval(() => {
            setRecordingDuration(prev => prev + 1);
         }, 1000);
      } catch (e: any) {
         toast.error('KhÃ´ng thá»ƒ káº¿t ná»‘i Microphone: ' + e.message);
      }
   };

   const handleStopRecordingClone = () => {
      if (mediaRecorderRef.current && isRecordingClone) {
         mediaRecorderRef.current.stop();
         setIsRecordingClone(false);
         if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
         }
      }
   };

   const removeCloneFile = (idx: number) => {
      setInstantFiles(prev => prev.filter((_, i) => i !== idx));
   };

   const togglePlayCloneFile = (idx: number) => {
      if (playingFileIndex === idx) {
         cloneAudioElementRef.current?.pause();
         setPlayingFileIndex(null);
         return;
      }
      if (cloneAudioElementRef.current) {
         cloneAudioElementRef.current.pause();
      }
      const audio = new Audio(instantFiles[idx].file);
      cloneAudioElementRef.current = audio;
      audio.play();
      audio.onended = () => setPlayingFileIndex(null);
      setPlayingFileIndex(idx);
   };

   const totalCloneDuration = instantFiles.reduce((sum, f) => sum + (f.duration || 0), 0);

   // Submit Instant Cloning
   const handleSaveInstantClone = async () => {
      if (!newVoiceName.trim()) {
         toast.warning('Vui lÃ²ng nháº­p tÃªn giá»ng nÃ³i');
         return;
      }
      if (instantFiles.length === 0) {
         toast.warning('Vui lÃ²ng cung cáº¥p Ã­t nháº¥t 1 file audio máº«u');
         return;
      }

      setIsSavingVoice(true);
      try {
         const response = await elevenlabsApi.addVoice({
            name: newVoiceName,
            description: newVoiceDescription,
            files: instantFiles.map(f => f.file)
         });
         if (response && response.voice_id) {
            toast.success('NhÃ¢n báº£n giá»ng nÃ³i thÃ nh cÃ´ng!');
            setVoiceId(response.voice_id);
            loadCustomVoices();
            setCreateStep('finish');
         }
      } catch (e: any) {
         toast.error('Lá»—i khi nhÃ¢n báº£n giá»ng nÃ³i: ' + e.message);
      } finally {
         setIsSavingVoice(false);
      }
   };

   // Custom voice design flow (Thiáº¿t káº¿ giá»ng nÃ³i)
   const handleGenerateDesignPreview = async () => {
      setIsGeneratingDesignPreview(true);
      setDesignPreviewUrl(null);
      try {
         const res = await elevenlabsApi.generateCustomVoicePreview({
            gender: designGender,
            age: designAge,
            accent: designAccent,
            accentStrength: designAccentStrength,
            text: designText
         });
         if (res && res.url) {
            setDesignPreviewVoiceId(res.generatedVoiceId);
            setDesignPreviewUrl(res.url);
            toast.success('Táº¡o báº£n nghe thá»­ thÃ nh cÃ´ng! Nháº¥n phÃ¡t Ä‘á»ƒ nghe.');
         }
      } catch (e: any) {
         toast.error('Lá»—i thiáº¿t káº¿ nghe thá»­: ' + e.message);
      } finally {
         setIsGeneratingDesignPreview(false);
      }
   };

   const handleSaveDesignedVoice = async () => {
      if (!newVoiceName.trim()) {
         toast.warning('Vui lÃ²ng nháº­p tÃªn giá»ng nÃ³i Ä‘á»ƒ lÆ°u.');
         return;
      }
      if (!designPreviewVoiceId) {
         toast.warning('Vui lÃ²ng báº¥m nghe thá»­ giá»ng nÃ³i trÆ°á»›c khi lÆ°u.');
         return;
      }

      setIsSavingVoice(true);
      try {
         const res = await elevenlabsApi.createCustomVoice({
            voiceName: newVoiceName,
            voiceDescription: newVoiceDescription || `Giá»ng tá»± thiáº¿t káº¿ (${designGender}, ${designAge}, ${designAccent})`,
            generatedVoiceId: designPreviewVoiceId
         });
         if (res && res.voice_id) {
            toast.success('LÆ°u giá»ng thiáº¿t káº¿ thÃ nh cÃ´ng!');
            setVoiceId(res.voice_id);
            loadCustomVoices();
            setCreateStep('finish');
         }
      } catch (e: any) {
         toast.error('Lá»—i lÆ°u giá»ng nÃ³i: ' + e.message);
      } finally {
         setIsSavingVoice(false);
      }
   };

   const selectedVoice = getSelectedVoice();
   const myVoicesList = availableVoices.filter(v => v.category === 'cloned' || v.category === 'generated' || v.category === 'custom');
   const libraryVoicesList = availableVoices.filter(v => !['cloned', 'generated', 'custom'].includes(v.category));
   const quickLibraryVoices = libraryVoicesList.slice(0, 8);
   const activeModelInfo = availableModels.find((model: any) => model.model_id === getActiveModelId(voiceModel));
   const multilingualModelDetails = getModelDetails('eleven_multilingual_v2', availableModels);
   const flashModelDetails = getModelDetails('eleven_flash_v2_5', availableModels);
   const turboModelDetails = getModelDetails('eleven_turbo_v2_5', availableModels);

   return (
      <div className="space-y-6 max-w-[1400px] mx-auto w-full pb-12 font-sans text-slate-800" id="voice_workspace_wrapper">

         {/* HEADER BANNER */}
         <div className="flex flex-col md:flex-row md:items-center justify-between bg-white border border-slate-100 rounded-2xl p-6 shadow-sm gap-4">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600">
                  <TapeIcon className="h-5 w-5 text-cyan-500" />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">NhÃ¢n báº£n giá»ng nÃ³i</h3>
                  <p className="text-xs text-slate-400 mt-1">Táº¡o audio tá»« vÄƒn báº£n, quáº£n lÃ½ giá»ng Ä‘Ã£ clone vÃ  lÆ°u lá»‹ch sá»­ giá»ng nÃ³i trong má»™t mÃ n hÃ¬nh.</p>
               </div>
            </div>
            <button
               onClick={() => {
                  setCreateStep('selection');
                  setCreationMode(null);
                  setInstantFiles([]);
                  setNewVoiceName('');
                  setNewVoiceDescription('');
                  setDesignPreviewUrl(null);
                  setDesignPreviewVoiceId(null);
                  setIsCreateModalOpen(true);
               }}
               className="px-4 py-2 bg-white hover:bg-slate-50 text-cyan-600 border border-cyan-150 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
               <Plus className="h-4 w-4" />
               NhÃ¢n báº£n giá»ng má»›i
            </button>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT COLUMN: Input Form */}
            <div className="lg:col-span-5 flex flex-col gap-6">
               <div className="border border-slate-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">

                  {/* Chosen Voice Panel */}
                  <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Giá»ng nÃ³i Ä‘Ã£ chá»n</label>
                        <button
                           onClick={() => {
                              setIsVoicePickerView(false);
                              setIsAdvancedModalOpen(true);
                           }}
                           className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 transition-all"
                        >
                           <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                           CÃ i Ä‘áº·t
                        </button>
                     </div>

                     <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-1 bg-slate-50/50">
                        <span className="text-xs font-bold text-slate-950 truncate">
                           {selectedVoice.label}{selectedVoice.description ? ` - ${selectedVoice.description}` : ''}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                           {selectedVoice.id === 'Sadaltager' ? 'iGen Audio v3' : (selectedVoice.tags || 'Giá»ng Ä‘Ã£ nhÃ¢n báº£n')}
                        </span>
                     </div>

                     <div className="grid grid-cols-5 gap-2 mt-1">
                        <button
                           onClick={() => {
                              setCreateStep('selection');
                              setCreationMode(null);
                              setInstantFiles([]);
                              setNewVoiceName('');
                              setNewVoiceDescription('');
                              setDesignPreviewUrl(null);
                              setDesignPreviewVoiceId(null);
                              setIsCreateModalOpen(true);
                           }}
                           className="col-span-4 py-2 border-2 border-dashed border-cyan-200 hover:border-cyan-400 text-cyan-600 hover:bg-cyan-50/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                           <Plus className="h-4 w-4" />
                           ThÃªm giá»ng nÃ³i má»›i
                        </button>
                        <button
                           onClick={() => {
                              setIsVoicePickerView(true);
                              setVoiceActiveTab('library');
                              setIsAdvancedModalOpen(true);
                           }}
                           className="col-span-1 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl flex items-center justify-center transition-all"
                           title="ThÆ° viá»‡n giá»ng nÃ³i"
                        >
                           <BookOpen className="h-4 w-4" />
                        </button>
                     </div>
                  </div>

                  {/* Style instructions & Templates */}
                  <div className="flex flex-col gap-2">
                     <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700">Ká»‹ch báº£n Ä‘á»c máº«u</label>
                        <select
                           value={VOICE_STYLE_TEMPLATES.find(t => t.prompt === selectedStylePrompt)?.id || 'none'}
                           onChange={(e) => {
                              const t = VOICE_STYLE_TEMPLATES.find(x => x.id === e.target.value);
                              setSelectedStylePrompt(t ? t.prompt : '');
                           }}
                           className="text-[11px] font-bold text-slate-600 border border-slate-200 rounded-lg p-1.5 px-2 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                           {VOICE_STYLE_TEMPLATES.map(t => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                           ))}
                        </select>
                     </div>
                  </div>

                  {/* TEXT AREA INPUT */}
                  <div className="flex flex-col gap-2">
                     <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 text-xs">VÄƒn báº£n cáº§n Ä‘á»c</h4>
                        <div className="text-[10px] text-slate-400 font-mono">
                           {text.length} kÃ½ tá»±
                        </div>
                     </div>

                     <div className="relative">
                        <textarea
                           placeholder="Nháº­p vÄƒn báº£n báº¡n muá»‘n chuyá»ƒn thÃ nh giá»ng nÃ³i... VÃ­ dá»¥: Xin chÃ o, tÃ´i lÃ  trá»£ lÃ½ áº£o AI cá»§a báº¡n!"
                           className="w-full text-xs p-4 border border-slate-200 rounded-xl h-44 focus:ring-1 focus:ring-cyan-500 focus:outline-none leading-relaxed font-sans resize-none"
                           value={text}
                           onChange={(e) => setText(e.target.value)}
                           disabled={isGenerating}
                        />
                     </div>
                  </div>

                  {/* Archive Title & Description Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">TiÃªu Ä‘á» lÆ°u trá»¯ <span className="text-slate-400 font-normal">(TÃ¹y chá»n)</span></label>
                        <input
                           type="text"
                           placeholder="VÃ­ dá»¥: Äoáº¡n má»Ÿ Ä‘áº§u Video"
                           value={archiveTitle}
                           onChange={(e) => setArchiveTitle(e.target.value)}
                           className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-700">MÃ´ táº£ / Ghi chÃº <span className="text-slate-400 font-normal">(TÃ¹y chá»n)</span></label>
                        <input
                           type="text"
                           placeholder="VÃ­ dá»¥: Äá»c nháº¥n nhÃ¡ Ä‘oáº¡n káº¿t"
                           value={archiveDescription}
                           onChange={(e) => setArchiveDescription(e.target.value)}
                           className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                     </div>
                  </div>

                  {/* Progress simulated bar and Action Button */}
                  <div className="flex flex-col gap-3 mt-1">
                     {(isGenerating || isOptimizing) && (
                        <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl animate-pulse">
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono">
                              <span>{isOptimizing ? 'AI ÄANG BIÃŠN SOáº N Láº I VÄ‚N Báº¢N...' : 'AI ÄANG MÃƒ HÃ“A GIá»ŒNG Äá»ŒC...'}</span>
                              <span>{isOptimizing ? optimizeProgress : generateProgress}%</span>
                           </div>
                           <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                 className="bg-cyan-500 h-full transition-all duration-300 rounded-full"
                                 style={{ width: `${isOptimizing ? optimizeProgress : generateProgress}%` }}
                              />
                           </div>
                        </div>
                     )}

                     <button
                        onClick={handleGenerate}
                        disabled={isGenerating || isOptimizing || !text.trim()}
                        className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${isGenerating || isOptimizing || !text.trim()
                           ? "bg-slate-100 text-slate-450 cursor-not-allowed"
                           : "bg-cyan-500 hover:bg-cyan-600 text-white active:scale-[0.99] shadow-md shadow-cyan-500/10"
                           }`}
                     >
                        {isGenerating ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <TapeIcon className="h-4.5 w-4.5" />}
                        Táº¡o Giá»ng NÃ³i
                     </button>
                  </div>

               </div>
            </div>

            {/* RIGHT COLUMN: Player & History */}
            <div className="lg:col-span-7 flex flex-col gap-6">

               {/* AUDIO OUTPUT BOX */}
               <div className="border border-slate-200 bg-white rounded-2xl shadow-xs p-5 min-h-[220px] flex flex-col justify-center">
                  {!audioUri ? (
                     <div className="flex flex-col items-center justify-center text-slate-400 text-center py-6">
                        <div className="p-4 bg-cyan-50/50 text-cyan-500 rounded-full mb-3 shadow-xs">
                           <TapeIcon className="h-8 w-8 text-cyan-500/70" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Audio sáº½ xuáº¥t hiá»‡n á»Ÿ Ä‘Ã¢y</span>
                        <span className="text-[10px] text-slate-450 mt-1">Chá»n giá»ng nÃ³i, nháº­p vÄƒn báº£n vÃ  nháº¥n &quot;Táº¡o Giá»ng NÃ³i&quot;</span>
                     </div>
                  ) : (
                     <div className="bg-white border border-slate-100 p-4 rounded-xl flex flex-col gap-3 shadow-xs">
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
                              className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-md cursor-pointer transition-transform active:scale-95"
                           >
                              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
                           </button>

                           <div className="flex-1 flex flex-col gap-1">
                              <span className="text-[10px] font-bold tracking-wide uppercase text-cyan-600 font-mono">Báº£n thu phÃ¡t Ã¢m má»›i nháº¥t</span>
                              <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-mono text-slate-400">{formatTime(currentTime)}</span>
                                 <div className="flex-1 relative group cursor-pointer h-1.5 bg-slate-100 rounded-full">
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
                              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-800 transition-colors"
                              title="Táº£i Ã¢m thanh WAV vá» mÃ¡y"
                           >
                              <Download className="h-4.5 w-4.5" />
                           </button>
                        </div>
                     </div>
                  )}
               </div>

               {/* Audio library list */}
               <div className="border border-slate-200 bg-white rounded-2xl shadow-xs p-5 flex flex-col gap-4">
                  <h4 className="font-bold text-slate-800 text-xs tracking-wider uppercase flex items-center gap-1.5 border-b pb-3">
                     <Clock className="h-4.5 w-4.5 text-cyan-650" />
                     Lá»‹ch sá»­ táº¡o giá»ng nÃ³i <span className="ml-1.5 px-2 py-0.5 bg-slate-100 rounded-full text-[10px] text-slate-500 font-mono font-bold">{history.length}</span>
                  </h4>

                  {isLoadingHistory ? (
                     <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Loader2 className="h-8 w-8 text-cyan-500 animate-spin mb-2" />
                        <span className="text-xs font-semibold uppercase tracking-wider font-mono">Äang Ä‘á»“ng bá»™ dá»¯ liá»‡u...</span>
                     </div>
                  ) : history.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed rounded-xl">
                        <TapeIcon className="h-10 w-10 text-slate-350 mb-2" />
                        <span className="text-xs font-semibold">ChÆ°a cÃ³ lá»‹ch sá»­ táº¡o giá»ng nÃ³i nÃ o</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Nháº­p ká»‹ch báº£n á»Ÿ trÃªn Ä‘á»ƒ lÆ°u báº£n thu cá»§a báº¡n</span>
                     </div>
                  ) : (
                     <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {history.map((record) => {
                           const id = record._id || record.id;
                           return (
                              <div
                                 key={id}
                                 className="bg-white border border-slate-150 p-3.5 rounded-xl hover:shadow-xs transition-all flex items-center justify-between gap-4"
                              >
                                 <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <button
                                       onClick={() => handlePlayHistory(record.url)}
                                       className="h-8 w-8 rounded-full bg-white hover:bg-slate-50 border flex items-center justify-center shrink-0 shadow-xs text-slate-500 hover:text-slate-700"
                                    >
                                       <Play className="h-4 w-4 ml-0.5 text-slate-400 fill-slate-400" />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                       <p className="text-xs font-bold text-slate-900 truncate">{record.prompt}</p>
                                       <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                          {record.metadata?.voiceName || 'Roger - Laid-Back, Casual, Resonant'}
                                       </p>
                                    </div>
                                 </div>

                                 <div className="flex items-center gap-1">
                                    <button
                                       onClick={() => handleDownload(record.url, `igen-voice-${id}.wav`)}
                                       className="p-2 text-slate-500 hover:bg-slate-50 rounded-md transition-colors"
                                       title="Táº£i vá» file WAV"
                                    >
                                       <Download className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                       onClick={() => handleDeleteHistory(id)}
                                       className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                       title="XÃ³a báº£n thu"
                                    >
                                       <Trash2 className="h-3.5 w-3.5" />
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

         {/* MODAL 1: ADVANCED SETTINGS & VOICE PICKER */}
         {isAdvancedModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
               <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">

                  {/* Modal Header */}
                  <div className="flex justify-between items-center border-b p-5 shrink-0">
                     <div>
                        <h3 className="font-bold text-slate-900 text-sm">CÃ i Ä‘áº·t giá»ng nÃ³i nÃ¢ng cao</h3>
                        <p className="text-[11px] text-slate-400 mt-1">Tinh chá»‰nh model, giá»ng vÃ  cÃ¡c thÃ´ng sá»‘ khÃ¡c Ä‘á»ƒ cÃ³ káº¿t quáº£ tá»‘t nháº¥t.</p>
                     </div>
                     <button
                        onClick={() => {
                           setIsAdvancedModalOpen(false);
                           setIsVoicePickerView(false);
                        }}
                        className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                     >
                        <X className="h-4.5 w-4.5" />
                     </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto flex-1 space-y-5">

                     {isVoicePickerView ? (
                        // VIEW: VOICE PICKER LIST
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                              <Search className="h-4 w-4 text-slate-400 shrink-0" />
                              <input
                                 type="text"
                                 placeholder="TÃ¬m kiáº¿m giá»ng nÃ³i..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 className="text-xs bg-transparent border-none focus:outline-none w-full"
                              />
                           </div>

                           {/* Tabs */}
                           <div className="flex border-b border-slate-100">
                              <button
                                 onClick={() => setVoiceActiveTab('my-voices')}
                                 className={`flex-1 pb-2 text-xs font-bold border-b-2 text-center transition-all ${voiceActiveTab === 'my-voices' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-slate-400'
                                    }`}
                              >
                                 Giá»ng cá»§a tÃ´i ({myVoicesList.length})
                              </button>
                              <button
                                 onClick={() => setVoiceActiveTab('library')}
                                 className={`flex-1 pb-2 text-xs font-bold border-b-2 text-center transition-all ${voiceActiveTab === 'library' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-slate-400'
                                    }`}
                              >
                                 ThÆ° viá»‡n ({libraryVoicesList.length})
                              </button>
                           </div>

                           {/* List voices */}
                           <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {voiceActiveTab === 'my-voices' ? (
                                 myVoicesList.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-xs">
                                       ChÆ°a cÃ³ giá»ng nÃ³i nhÃ¢n báº£n nÃ o. Báº¥m &quot;ThÃªm giá»ng nÃ³i má»›i&quot; á»Ÿ trang chÃ­nh Ä‘á»ƒ nhÃ¢n báº£n.
                                    </div>
                                 ) : (
                                    myVoicesList.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).map(v => {
                                       const isSelected = voiceId === v.voice_id;
                                       return (
                                          <div
                                             key={v.voice_id}
                                             onClick={() => {
                                                setVoiceId(v.voice_id);
                                                setIsVoicePickerView(false);
                                             }}
                                             className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-cyan-50/50 border-cyan-300' : 'hover:bg-slate-50 border-slate-100'
                                                }`}
                                          >
                                             <div className="flex items-center gap-3">
                                                <button
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      handlePreviewVoice(v.voice_id);
                                                   }}
                                                   className="h-8 w-8 rounded-full bg-white border flex items-center justify-center text-slate-700 shadow-xs shrink-0"
                                                >
                                                   <Play className="h-4 w-4 ml-0.5" />
                                                </button>
                                                <div>
                                                   <p className="text-xs font-bold text-slate-900">{v.name}</p>
                                                   <p className="text-[10px] text-slate-450 mt-0.5">Giá»ng Ä‘Ã£ nhÃ¢n báº£n</p>
                                                </div>
                                             </div>
                                             <button
                                                onClick={(e) => handleDeleteCustomVoice(e, v.voice_id)}
                                                className="p-1.5 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                                                title="XÃ³a giá»ng nhÃ¢n báº£n"
                                             >
                                                <Trash2 className="h-4 w-4" />
                                             </button>
                                          </div>
                                       );
                                    })
                                 )
                              ) : (
                                 libraryVoicesList.filter(v => (v.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (v.description || '').toLowerCase().includes(searchQuery.toLowerCase())).map(v => {
                                    const isSelected = voiceId === v.voice_id;
                                    return (
                                       <div
                                          key={v.voice_id}
                                          onClick={() => {
                                             setVoiceId(v.voice_id);
                                             setIsVoicePickerView(false);
                                          }}
                                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-cyan-50/50 border-cyan-300' : 'hover:bg-slate-50 border-slate-100'
                                             }`}
                                       >
                                          <div className="flex items-center gap-3">
                                             <button
                                                onClick={(e) => {
                                                   e.stopPropagation();
                                                   handlePreviewVoice(v.voice_id);
                                                }}
                                                className="h-8 w-8 rounded-full bg-white border flex items-center justify-center text-slate-700 shadow-xs shrink-0"
                                             >
                                                <Play className="h-4 w-4 ml-0.5" />
                                             </button>
                                             <div>
                                                <p className="text-xs font-bold text-slate-900">{v.label} ({v.gender === 'male' ? 'Nam' : 'Ná»¯'})</p>
                                                <p className="text-[10px] text-slate-450 mt-0.5">{v.description}</p>
                                             </div>
                                          </div>
                                          {isSelected && (
                                             <Check className="h-4 w-4 text-cyan-600 mr-2" />
                                          )}
                                       </div>
                                    );
                                 })
                              )}
                           </div>

                           <button
                              onClick={() => setIsVoicePickerView(false)}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                           >
                              Quay láº¡i
                           </button>
                        </div>
                     ) : (
                        // VIEW: ADVANCED SETTINGS CONTROLS
                        <div className="space-y-5">

                           {/* Selector field */}
                           <div className="flex flex-col gap-1.5">
                              <span className="text-xs font-bold text-slate-700">Giá»ng nÃ³i (Voice)</span>
                              <div className="flex items-center gap-2">
                                 <div
                                    onClick={() => setIsVoicePickerView(true)}
                                    className="flex-1 flex items-center justify-between border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-all"
                                 >
                                    <div className="flex items-center gap-2">
                                       <span className="text-xs font-bold text-slate-900">{selectedVoice.label}</span>
                                       <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">({selectedVoice.description})</span>
                                    </div>
                                    <ChevronRight className="h-4.5 w-4.5 text-slate-400" />
                                 </div>

                                 <div
                                    className="relative"
                                    onMouseEnter={() => setIsVoiceLibraryHoverOpen(true)}
                                    onMouseLeave={() => setIsVoiceLibraryHoverOpen(false)}
                                 >
                                    <button
                                       type="button"
                                       className="flex h-[50px] w-[50px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
                                       title="Hover de xem thu vien giong noi"
                                    >
                                       <BookOpen className="h-4.5 w-4.5" />
                                    </button>

                                    {isVoiceLibraryHoverOpen && (
                                       <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                                          <div className="mb-2 flex items-center justify-between gap-3 px-1">
                                             <div>
                                                <p className="text-xs font-bold text-slate-900">Thu vien giong noi</p>
                                                <p className="text-[10px] text-slate-400">Hover nhanh de chon voice ElevenLabs</p>
                                             </div>
                                             <button
                                                type="button"
                                                onClick={() => {
                                                   setVoiceActiveTab('library');
                                                   setIsVoicePickerView(true);
                                                   setIsVoiceLibraryHoverOpen(false);
                                                }}
                                                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-100"
                                             >
                                                Xem tat ca
                                             </button>
                                          </div>

                                          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                                             {quickLibraryVoices.map((voice) => {
                                                const isSelected = voiceId === voice.voice_id;
                                                return (
                                                   <button
                                                      key={voice.voice_id}
                                                      type="button"
                                                      onClick={() => {
                                                         setVoiceId(voice.voice_id);
                                                         setIsVoiceLibraryHoverOpen(false);
                                                      }}
                                                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                                                         isSelected ? "border-cyan-300 bg-cyan-50/60" : "border-slate-100 hover:bg-slate-50"
                                                      }`}
                                                   >
                                                      <div className="flex min-w-0 items-center gap-3">
                                                         <button
                                                            type="button"
                                                            onClick={(event) => {
                                                               event.stopPropagation();
                                                               handlePreviewVoice(voice.voice_id);
                                                            }}
                                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs"
                                                         >
                                                            <Play className="ml-0.5 h-3.5 w-3.5" />
                                                         </button>
                                                         <div className="min-w-0">
                                                            <p className="truncate text-xs font-bold text-slate-900">{voice.label || voice.name}</p>
                                                            <p className="truncate text-[10px] text-slate-400">{voice.description || "ElevenLabs voice"}</p>
                                                         </div>
                                                      </div>
                                                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-cyan-600" /> : null}
                                                   </button>
                                                );
                                             })}
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           </div>

                           {/* Model AI selection cards */}
                           <div className="flex flex-col gap-2">
                              <span className="text-xs font-bold text-slate-700">Model AI</span>
                              {activeModelInfo?.name && (
                                 <span className="text-[10px] text-slate-400">Dang su dung model ElevenLabs: {activeModelInfo.name}</span>
                              )}
                              <span className="text-[10px] text-slate-400 font-medium leading-relaxed">Chá»n mÃ´ hÃ¬nh phÃ¹ há»£p vá»›i má»¥c tiÃªu táº¡o giá»ng nÃ³i cá»§a báº¡n.</span>
                              <div className="flex flex-col gap-2.5">
                                 {MODEL_OPTIONS.map((opt) => {
                                    const isSelected = voiceModel === opt.key;
                                    const modelDetails = opt.key === 'eleven_flash_v2_5' ? flashModelDetails : turboModelDetails;
                                    return (
                                       <div
                                          key={opt.key}
                                          onClick={() => setVoiceModel(opt.key)}
                                          title={`NgÃ´n ngá»¯ há»— trá»£: ${modelDetails.languageSummary}`}
                                          className={`border-2 rounded-xl p-4 cursor-pointer transition-all relative ${isSelected ? 'border-cyan-500 bg-cyan-50/10' : 'border-slate-150 hover:bg-slate-50'
                                             }`}
                                       >
                                          <div className="flex justify-between items-start">
                                             <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                                             {isSelected && <Check className="h-4 w-4 text-cyan-600" />}
                                          </div>
                                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                             {opt.description}
                                          </p>
                                          <div className="flex gap-1.5 mt-2.5">
                                             {opt.badges.map((badge, bIdx) => (
                                                <span key={bIdx} className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                   badge === 'Low Latency' || badge === 'Low latency'
                                                      ? 'bg-cyan-50 border border-cyan-100 text-cyan-700'
                                                      : badge === 'Balanced'
                                                      ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                                                      : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                   {badge}
                                                </span>
                                             ))}
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>

                           {/* Stability slider */}
                           <div className="flex flex-col gap-2">
                              <div className="flex justify-between text-xs font-bold text-slate-700">
                                 <span>Stability</span>
                                 <span className="font-mono text-cyan-600">{stability.toFixed(2)}</span>
                              </div>
                              <input
                                 type="range"
                                 min="0.0"
                                 max="1.0"
                                 step="0.05"
                                 value={stability}
                                 onChange={(e) => setStability(parseFloat(e.target.value))}
                                 className="w-full accent-cyan-500 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                 <span>Creative</span>
                                 <span>Robust</span>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[10px] text-slate-500 leading-relaxed">
                                 <span className="font-bold text-slate-700">TÃ³m táº¯t há»— trá»£ ngÃ´n ngá»¯:</span>{' '}
                                 {voiceModel === 'eleven_turbo_v2_5' && (turboModelDetails.languageNames.length > 0
                                    ? turboModelDetails.languageNames.slice(0, 8).join(', ')
                                    : 'ChÆ°a cÃ³ metadata ngÃ´n ngá»¯ tá»« ElevenLabs API')}
                                 {voiceModel === 'eleven_flash_v2_5' && (flashModelDetails.languageNames.length > 0
                                    ? flashModelDetails.languageNames.slice(0, 8).join(', ')
                                    : 'ChÆ°a cÃ³ metadata ngÃ´n ngá»¯ tá»« ElevenLabs API')}
                              </div>
                           </div>

                           <div className="flex flex-col gap-2">
                              <div className="flex justify-between text-xs font-bold text-slate-700">
                                 <span>Similarity Boost</span>
                                 <span className="font-mono text-cyan-600">{similarityBoost.toFixed(2)}</span>
                              </div>
                              <input
                                 type="range"
                                 min="0.0"
                                 max="1.0"
                                 step="0.05"
                                 value={similarityBoost}
                                 onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                                 className="w-full accent-cyan-500 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                 <span>Creative</span>
                                 <span>Consistent</span>
                              </div>
                           </div>

                           <div className="flex items-center justify-between border-t pt-4">
                              <div>
                                 <span className="text-xs font-bold text-slate-800">Speaker Boost</span>
                                 <p className="text-[10px] text-slate-400 mt-0.5">Su dung voice setting goc cua ElevenLabs de day do ro va do day giong noi.</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                 <input
                                    type="checkbox"
                                    checked={useSpeakerBoost}
                                    onChange={(e) => setUseSpeakerBoost(e.target.checked)}
                                    className="sr-only peer"
                                 />
                                 <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                              </label>
                           </div>

                           {/* Switch language detection */}
                           <div className="flex items-center justify-between border-t pt-4">
                              <div>
                                 <span className="text-xs font-bold text-slate-800">Chá»n ngÃ´n ngá»¯ Ä‘á»c</span>
                                 <p className="text-[10px] text-slate-400 mt-0.5">Báº­t khi tá»± nháº­n diá»‡n sai tiáº¿ng hoáº·c vÄƒn báº£n cÃ³ dáº¥u tiáº¿ng Viá»‡t.</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                 <input
                                    type="checkbox"
                                    checked={useLanguageToggle}
                                    onChange={(e) => setUseLanguageToggle(e.target.checked)}
                                    className="sr-only peer"
                                 />
                                 <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                              </label>
                           </div>
                        </div>
                     )}

                  </div>

                  {/* Modal Footer */}
                  <div className="border-t p-4 flex justify-between items-center bg-slate-50 shrink-0">
                     <button
                        onClick={() => {
                           setVoiceId(availableVoices[0]?.voice_id || '');
                           setStability(0.50);
                           setSimilarityBoost(0.75);
                           setUseSpeakerBoost(true);
                           setVoiceModel('eleven_turbo_v2_5');
                           setUseLanguageToggle(true);
                           toast.success('ÄÃ£ khÃ´i phá»¥c cÃ i Ä‘áº·t máº·c Ä‘á»‹nh.');
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                     >
                        Reset
                     </button>
                     <button
                        onClick={handleSaveVoiceSettings}
                        disabled={isSavingVoiceSettings}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                     >
                        {isSavingVoiceSettings ? 'Dang luu...' : 'Luu settings'}
                     </button>
                     <button
                        onClick={() => {
                           setIsAdvancedModalOpen(false);
                           setIsVoicePickerView(false);
                        }}
                        className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-500/10"
                     >
                        ÄÃ³ng
                     </button>
                  </div>

               </div>
            </div>
         )}

         {/* MODAL 2: CREATE/CLONE VOICE DIALOG */}
         {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
               <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">

                  {/* Modal Header */}
                  <div className="flex justify-between items-center border-b p-5 shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-[#e0f7fc] text-[#0891b2] flex items-center justify-center rounded-xl shrink-0">
                           <Sparkles className="h-5 w-5 fill-[#0891b2]/10" />
                        </div>
                        <span className="font-semibold text-slate-800 text-base">
                           {createStep === 'selection' && 'Táº¡o giá»ng nÃ³i má»›i'}
                           {creationMode === 'instant' && 'NhÃ¢n báº£n Giá»ng nÃ³i Tá»©c thÃ¬'}
                           {creationMode === 'design' && 'Thiáº¿t káº¿ Giá»ng nÃ³i'}
                           {createStep === 'finish' && 'NhÃ¢n báº£n Giá»ng nÃ³i Tá»©c thÃ¬'}
                        </span>
                     </div>
                     <button
                        onClick={() => setIsCreateModalOpen(false)}
                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                     >
                        <X className="h-4.5 w-4.5" />
                     </button>
                  </div>

                  {/* Step indicators */}
                  {createStep !== 'selection' && createStep !== 'design' && (
                     <div className="flex items-center justify-between px-16 py-6 border-b bg-slate-50/40 shrink-0">
                        {/* Step 1 */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                           <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${createStep === 'upload'
                              ? 'bg-[#e0f7fc] border border-[#22d3ee] text-[#0891b2] shadow-xs'
                              : 'bg-[#e0f7fc] border border-[#22d3ee] text-[#0891b2]'
                              }`}>
                              1
                           </div>
                           <span className={`text-[11px] font-bold transition-all duration-300 ${createStep === 'upload' ? 'text-[#0891b2]' : 'text-slate-400'
                              }`}>
                              Táº£i lÃªn Audio
                           </span>
                        </div>

                        {/* Divider */}
                        <div className="h-0.5 bg-slate-100 flex-1 -mt-4" />

                        {/* Step 2 */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                           <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${createStep === 'info'
                              ? 'bg-[#e0f7fc] border border-[#22d3ee] text-[#0891b2] shadow-xs'
                              : createStep === 'finish'
                                 ? 'bg-emerald-50 border border-emerald-400 text-emerald-600'
                                 : 'bg-slate-100 border border-slate-200 text-slate-400'
                              }`}>
                              2
                           </div>
                           <span className={`text-[11px] font-bold transition-all duration-300 ${createStep === 'info' ? 'text-[#0891b2]' : 'text-slate-400'
                              }`}>
                              ThÃ´ng tin giá»ng nÃ³i
                           </span>
                        </div>

                        {/* Divider */}
                        <div className="h-0.5 bg-slate-100 flex-1 -mt-4" />

                        {/* Step 3 */}
                        <div className="flex flex-col items-center gap-1.5 flex-1">
                           <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${createStep === 'finish'
                              ? 'bg-[#e0f7fc] border border-[#22d3ee] text-[#0891b2] shadow-xs'
                              : 'bg-slate-100 border border-slate-200 text-slate-400'
                              }`}>
                              3
                           </div>
                           <span className={`text-[11px] font-bold transition-all duration-300 ${createStep === 'finish' ? 'text-[#0891b2]' : 'text-slate-400'
                              }`}>
                              HoÃ n táº¥t
                           </span>
                        </div>
                     </div>
                  )}

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto flex-1">

                     {/* STEP: SELECTION */}
                     {createStep === 'selection' && (
                        <div className="flex flex-col gap-3">
                           {/* Option 1: Thiáº¿t káº¿ Giá»ng nÃ³i */}
                           <div
                              onClick={() => {
                                 setCreationMode('design');
                                 setCreateStep('design');
                              }}
                              className="p-4 rounded-xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/5 cursor-pointer transition-all flex justify-between items-center group"
                           >
                              <div className="flex items-start gap-4">
                                 <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700 group-hover:text-cyan-600 group-hover:bg-cyan-50 transition-colors">
                                    <Wand2 className="h-5 w-5" />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-xs text-slate-900">Thiáº¿t káº¿ Giá»ng nÃ³i</h4>
                                    <p className="text-[10px] text-slate-450 mt-0.5">Thiáº¿t káº¿ má»™t giá»ng nÃ³i hoÃ n toÃ n má»›i tá»« vÄƒn báº£n.</p>
                                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 mt-2">DÆ°á»›i 1 phÃºt</span>
                                 </div>
                              </div>
                              <ChevronRight className="h-4.5 w-4.5 text-slate-400" />
                           </div>

                           {/* Option 2: NhÃ¢n báº£n Giá»ng nÃ³i Tá»©c thÃ¬ */}
                           <div
                              onClick={() => {
                                 toast.info('TÃ­nh nÄƒng NhÃ¢n báº£n Giá»ng nÃ³i Tá»©c thÃ¬ Ä‘ang Ä‘Æ°á»£c phÃ¡t triá»ƒn!');
                              }}
                              className="p-4 rounded-xl border border-slate-200 opacity-60 cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/5 transition-all flex justify-between items-center group"
                           >
                              <div className="flex items-start gap-4">
                                 <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700 group-hover:text-cyan-600 group-hover:bg-cyan-50 transition-colors">
                                    <Sparkles className="h-5 w-5" />
                                 </div>
                                 <div>
                                    <div className="flex items-center gap-1.5">
                                       <h4 className="font-bold text-xs text-slate-900">NhÃ¢n báº£n Giá»ng nÃ³i Tá»©c thÃ¬ (Instant)</h4>
                                       <span className="px-1 py-0.5 bg-cyan-50 text-[8px] font-bold text-cyan-600 rounded">Äang phÃ¡t triá»ƒn</span>
                                    </div>
                                    <p className="text-[10px] text-slate-450 mt-0.5">NhÃ¢n báº£n giá»ng nÃ³i cá»§a báº¡n chá»‰ vá»›i 10 giÃ¢y Ã¢m thanh.</p>
                                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 mt-2">~2 phÃºt</span>
                                 </div>
                              </div>
                              <ChevronRight className="h-4.5 w-4.5 text-slate-400" />
                           </div>

                           {/* Option 3: NhÃ¢n báº£n Giá»ng nÃ³i ChuyÃªn nghiá»‡p */}
                           <div
                              className="p-4 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed flex justify-between items-center"
                              title="GÃ³i hiá»‡n táº¡i khÃ´ng há»— trá»£ chá»©c nÄƒng nÃ y"
                           >
                              <div className="flex items-start gap-4">
                                 <div className="p-2.5 bg-slate-50 rounded-lg text-slate-400">
                                    <Diamond className="h-5 w-5" />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-xs text-slate-900">NhÃ¢n báº£n Giá»ng nÃ³i ChuyÃªn nghiá»‡p</h4>
                                    <p className="text-[10px] text-slate-450 mt-0.5">Táº¡o báº£n sao ká»¹ thuáº­t sá»‘ chÃ¢n thá»±c nháº¥t. YÃªu cáº§u 30 phÃºt Ã¢m thanh sáº¡ch.</p>
                                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-400 mt-2">~4 giá»</span>
                                 </div>
                              </div>
                              <X className="h-4 w-4 text-slate-350" />
                           </div>

                           {/* Option 4: Phá»‘i láº¡i Giá»ng nÃ³i */}
                           <div
                              className="p-4 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed flex justify-between items-center"
                              title="GÃ³i hiá»‡n táº¡i khÃ´ng há»— trá»£ chá»©c nÄƒng nÃ y"
                           >
                              <div className="flex items-start gap-4">
                                 <div className="p-2.5 bg-slate-50 rounded-lg text-slate-400">
                                    <Shuffle className="h-5 w-5" />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-xs text-slate-900">Phá»‘i láº¡i Giá»ng nÃ³i</h4>
                                    <p className="text-[10px] text-slate-450 mt-0.5">Biáº¿n Ä‘á»•i cÃ¡c giá»ng nÃ³i hiá»‡n cÃ³ báº±ng vÄƒn báº£n Ä‘á»ƒ táº¡o ra giá»ng nÃ³i má»›i.</p>
                                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-400 mt-2">DÆ°á»›i 1 phÃºt</span>
                                 </div>
                              </div>
                              <X className="h-4 w-4 text-slate-350" />
                           </div>
                        </div>
                     )}

                     {/* STEP: UPLOAD (INSTANT MODE) */}
                     {createStep === 'upload' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="grid grid-cols-3 gap-3">
                              <div className="flex flex-col items-center text-center p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                 <VolumeX className="h-5 w-5 text-slate-500 mb-2" />
                                 <span className="text-[11px] font-bold text-slate-800">TrÃ¡nh tiáº¿ng á»“n</span>
                                 <span className="text-[10px] text-slate-400 mt-1 leading-relaxed">Ã‚m thanh ná»n áº£nh hÆ°á»Ÿng cháº¥t lÆ°á»£ng</span>
                              </div>
                              <div className="flex flex-col items-center text-center p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                 <Headphones className="h-5 w-5 text-slate-500 mb-2" />
                                 <span className="text-[11px] font-bold text-slate-800">Cháº¥t lÆ°á»£ng micro</span>
                                 <span className="text-[10px] text-slate-400 mt-1 leading-relaxed">DÃ¹ng mic ngoÃ i Ä‘á»ƒ thu tá»‘t hÆ¡n</span>
                              </div>
                              <div className="flex flex-col items-center text-center p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                 <Laptop className="h-5 w-5 text-slate-500 mb-2" />
                                 <span className="text-[11px] font-bold text-slate-800">Thiáº¿t bá»‹ nháº¥t quÃ¡n</span>
                                 <span className="text-[10px] text-slate-400 mt-1 leading-relaxed">KhÃ´ng Ä‘á»•i micro giá»¯a cÃ¡c máº«u</span>
                              </div>
                           </div>

                           {/* Upload dashed zone */}
                           <div className="border-2 border-dashed border-slate-200 hover:border-[#22d3ee]/80 hover:bg-[#e0f7fc]/5 rounded-2xl p-7 flex flex-col items-center justify-center text-center relative transition-all duration-300">
                              <Upload className="h-9 w-9 text-slate-400 mb-2.5" />
                              <label className="text-xs font-bold text-slate-800 cursor-pointer hover:text-cyan-600 transition-colors">
                                 Nháº¥n Ä‘á»ƒ táº£i lÃªn hoáº·c kÃ©o tháº£
                                 <input
                                    type="file"
                                    accept="audio/*,video/*"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="hidden"
                                 />
                              </label>
                              <p className="text-[10px] text-slate-400 mt-1">File audio hoáº·c video, tá»‘i Ä‘a 10MB má»—i file</p>

                              <div className="flex items-center gap-2 my-3">
                                 <span className="text-[10px] text-slate-400">hoáº·c</span>
                              </div>

                              <button
                                 onClick={isRecordingClone ? handleStopRecordingClone : handleStartRecordingClone}
                                 className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all duration-300 border border-slate-200 bg-white ${isRecordingClone
                                    ? 'border-red-400 text-red-500 hover:bg-red-50/50 animate-pulse'
                                    : 'text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                              >
                                 {isRecordingClone ? <MicOff className="h-3.5 w-3.5 text-red-500" /> : <Mic className="h-3.5 w-3.5 text-slate-500" />}
                                 <span>{isRecordingClone ? `Ghi Ã¢m trá»±c tiáº¿p... (${recordingDuration}s)` : 'Ghi Ã¢m trá»±c tiáº¿p'}</span>
                              </button>
                           </div>

                           {/* List of uploaded/recorded samples */}
                           {instantFiles.length > 0 && (
                              <div className="space-y-2">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File Ä‘Ã£ táº£i lÃªn ({instantFiles.length})</span>
                                 <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                    {instantFiles.map((file, i) => (
                                       <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                             <button
                                                onClick={() => togglePlayCloneFile(i)}
                                                className="h-6 w-6 rounded-full bg-white hover:bg-slate-150 flex items-center justify-center shrink-0 border text-slate-650"
                                             >
                                                {playingFileIndex === i ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
                                             </button>
                                             <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-bold text-slate-800 truncate">{file.name}</p>
                                                <p className="text-[9px] text-slate-400">
                                                   {(file.size / 1024).toFixed(1)} KB {file.duration ? `â€¢ ${file.duration.toFixed(1)}s` : ''}
                                                </p>
                                             </div>
                                          </div>
                                          <button
                                             onClick={() => removeCloneFile(i)}
                                             className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-50 rounded"
                                          >
                                             <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}

                           {/* Progress Bar & requirement */}
                           <div className="flex items-center justify-between gap-4 border-t pt-3.5">
                              <div className="flex-1 bg-slate-150 h-2 rounded-full overflow-hidden">
                                 <div
                                    className="bg-cyan-500 h-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, (totalCloneDuration / 10) * 100)}%` }}
                                 />
                              </div>
                              <span className={`text-[10px] font-mono font-bold shrink-0 ${totalCloneDuration >= 10 ? 'text-emerald-600' : 'text-slate-450'}`}>
                                 {totalCloneDuration.toFixed(1)}s / 10s tá»‘i thiá»ƒu
                              </span>
                           </div>

                           {totalCloneDuration < 10 && instantFiles.length > 0 && (
                              <div className="flex items-start gap-1.5 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                                 <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                 <span className="text-[10px] text-amber-700 leading-relaxed">
                                    Tá»•ng thá»i gian cá»§a cÃ¡c máº«u audio pháº£i Ä‘áº¡t Ã­t nháº¥t 10 giÃ¢y. Vui lÃ²ng ghi Ã¢m thÃªm hoáº·c táº£i lÃªn thÃªm file máº«u.
                                 </span>
                              </div>
                           )}

                        </div>
                     )}

                     {/* STEP: VOICE INFO (INSTANT CLONING) */}
                     {createStep === 'info' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-700">TÃªn giá»ng nÃ³i <span className="text-red-500">*</span></label>
                              <input
                                 type="text"
                                 placeholder="VÃ­ dá»¥: Giá»ng thÆ°Æ¡ng hiá»‡u cá»§a tÃ´i"
                                 value={newVoiceName}
                                 onChange={(e) => setNewVoiceName(e.target.value)}
                                 className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                              <p className="text-[10px] text-slate-400">TÃªn nÃ y giÃºp báº¡n nháº­n diá»‡n giá»ng nÃ³i trong thÆ° viá»‡n sau khi clone.</p>
                           </div>

                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-700">MÃ´ táº£ giá»ng Ä‘á»c <span className="text-slate-400 font-normal">(tÃ¹y chá»n)</span></label>
                              <textarea
                                 placeholder="MÃ´ táº£ cho giá»ng nÃ³i, vÃ­ dá»¥: Giá»ng nam, áº¥m Ã¡p, chuyÃªn nghiá»‡p..."
                                 value={newVoiceDescription}
                                 onChange={(e) => setNewVoiceDescription(e.target.value)}
                                 className="w-full text-xs p-3 border border-slate-200 rounded-xl h-20 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                              />
                           </div>

                           {/* Confirmation summary */}
                           <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chi tiáº¿t máº«u nhÃ¢n báº£n</span>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                 <div>
                                    <span className="text-slate-400 block text-[10px]">Sá»‘ file máº«u:</span>
                                    <span className="font-bold text-slate-800">{instantFiles.length} file</span>
                                 </div>
                                 <div>
                                    <span className="text-slate-400 block text-[10px]">Tá»•ng thá»i lÆ°á»£ng máº«u:</span>
                                    <span className="font-bold text-slate-800">{totalCloneDuration.toFixed(1)} giÃ¢y</span>
                                 </div>
                              </div>
                           </div>

                           <div className="flex items-start gap-1.5 p-3.5 bg-blue-50 rounded-xl border border-blue-200">
                              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                              <span className="text-[10px] text-blue-700 leading-relaxed">
                                 Nháº¥n &quot;Báº¯t Ä‘áº§u nhÃ¢n báº£n&quot; bÃªn dÆ°á»›i Ä‘á»ƒ táº£i lÃªn dá»¯ liá»‡u. QuÃ¡ trÃ¬nh nÃ y sáº½ máº¥t tá»« 10 Ä‘áº¿n 30 giÃ¢y Ä‘á»ƒ ElevenLabs phÃ¢n tÃ­ch.
                              </span>
                           </div>
                        </div>
                     )}

                     {/* STEP: DESIGN VOICE (THIáº¾T Káº¾ GIá»ŒNG NÃ“I) */}
                     {createStep === 'design' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="grid grid-cols-3 gap-3">
                              {/* Gender */}
                              <div className="flex flex-col gap-1.5">
                                 <span className="text-xs font-bold text-slate-700">Giá»›i tÃ­nh</span>
                                 <select
                                    value={designGender}
                                    onChange={(e) => setDesignGender(e.target.value as any)}
                                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white"
                                 >
                                    <option value="female">Ná»¯ (Female)</option>
                                    <option value="male">Nam (Male)</option>
                                 </select>
                              </div>

                              {/* Age */}
                              <div className="flex flex-col gap-1.5">
                                 <span className="text-xs font-bold text-slate-700">Tuá»•i tÃ¡c</span>
                                 <select
                                    value={designAge}
                                    onChange={(e) => setDesignAge(e.target.value as any)}
                                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white"
                                 >
                                    <option value="young">Tráº» (Young)</option>
                                    <option value="middle_aged">Trung niÃªn (Middle)</option>
                                    <option value="old">Cao tuá»•i (Old)</option>
                                 </select>
                              </div>

                              {/* Accent */}
                              <div className="flex flex-col gap-1.5">
                                 <span className="text-xs font-bold text-slate-700">Quá»‘c gia / Accent</span>
                                 <select
                                    value={designAccent}
                                    onChange={(e) => setDesignAccent(e.target.value)}
                                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white"
                                 >
                                    <option value="american">Má»¹ (American)</option>
                                    <option value="british">Anh (British)</option>
                                    <option value="african">Phi (African)</option>
                                    <option value="australian">Ãšc (Australian)</option>
                                    <option value="indian">áº¤n Äá»™ (Indian)</option>
                                 </select>
                              </div>
                           </div>

                           {/* Accent Strength Slider */}
                           <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-xs font-bold text-slate-700">
                                 <span>Tá»· trá»ng giá»ng Ä‘á»‹a phÆ°Æ¡ng (Accent Strength)</span>
                                 <span className="font-mono text-cyan-600">{designAccentStrength.toFixed(2)}</span>
                              </div>
                              <input
                                 type="range"
                                 min="0.3"
                                 max="2.0"
                                 step="0.05"
                                 value={designAccentStrength}
                                 onChange={(e) => setDesignAccentStrength(parseFloat(e.target.value))}
                                 className="w-full accent-cyan-500 cursor-pointer"
                              />
                           </div>

                           {/* Preview script */}
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-slate-700">VÄƒn báº£n nghe thá»­</label>
                              <textarea
                                 value={designText}
                                 onChange={(e) => setDesignText(e.target.value)}
                                 className="w-full text-xs p-3 border border-slate-200 rounded-xl h-20 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                              />
                           </div>

                           {/* Actions for preview */}
                           <div className="flex gap-2 justify-end">
                              <button
                                 onClick={handleGenerateDesignPreview}
                                 disabled={isGeneratingDesignPreview || !designText.trim()}
                                 className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                 {isGeneratingDesignPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Táº¡o báº£n nghe thá»­'}
                              </button>

                              {designPreviewUrl && (
                                 <button
                                    onClick={() => playPreviewAudio(designPreviewUrl)}
                                    className="px-4 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                 >
                                    <Play className="h-3.5 w-3.5" />
                                    PhÃ¡t nghe thá»­
                                 </button>
                              )}
                           </div>

                           {/* Save custom designed voice name */}
                           {designPreviewVoiceId && (
                              <div className="border-t pt-4 space-y-3">
                                 <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-700">Äáº·t tÃªn giá»ng nÃ³i Ä‘á»ƒ lÆ°u</label>
                                    <input
                                       type="text"
                                       placeholder="VÃ­ dá»¥: Giá»ng thiáº¿t káº¿ tráº» trung Má»¹"
                                       value={newVoiceName}
                                       onChange={(e) => setNewVoiceName(e.target.value)}
                                       className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                 </div>
                                 <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-slate-700">MÃ´ táº£ giá»ng nÃ³i</label>
                                    <input
                                       type="text"
                                       placeholder="VÃ­ dá»¥: Giá»ng Ä‘á»c tráº» trung, nÄƒng Ä‘á»™ng"
                                       value={newVoiceDescription}
                                       onChange={(e) => setNewVoiceDescription(e.target.value)}
                                       className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                 </div>
                              </div>
                           )}

                        </div>
                     )}

                     {/* STEP: FINISH */}
                     {createStep === 'finish' && (
                        <div className="flex flex-col items-center text-center p-6 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shadow-sm">
                              <Check className="h-6 w-6" />
                           </div>
                           <h4 className="font-bold text-slate-900 text-sm">Giá»ng nÃ³i Ä‘Ã£ Ä‘Æ°á»£c táº¡o thÃ nh cÃ´ng!</h4>
                           <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                              Giá»ng &quot;{newVoiceName}&quot; Ä‘Ã£ sáºµn sÃ ng hoáº¡t Ä‘á»™ng. BÃ¢y giá» báº¡n cÃ³ thá»ƒ Ä‘Ã³ng há»™p thoáº¡i nÃ y vÃ  sá»­ dá»¥ng nÃ³ Ä‘á»ƒ chuyá»ƒn vÄƒn báº£n thÃ nh giá»ng nÃ³i.
                           </p>
                        </div>
                     )}

                  </div>

                  {/* Modal Footer */}
                  <div className="border-t p-4 flex justify-between items-center bg-slate-50 shrink-0">
                     {createStep !== 'finish' ? (
                        <>
                           <button
                              onClick={() => {
                                 if (createStep === 'upload' || createStep === 'design') {
                                    setCreateStep('selection');
                                 } else if (createStep === 'info') {
                                    setCreateStep('upload');
                                 } else {
                                    setIsCreateModalOpen(false);
                                 }
                              }}
                              className="px-2 py-2 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                           >
                              <ChevronLeft className="h-3.5 w-3.5" />
                              Quay láº¡i
                           </button>

                           {/* Action Submit/Next */}
                           {createStep === 'upload' && (
                              <button
                                 onClick={() => setCreateStep('info')}
                                 disabled={totalCloneDuration < 10}
                                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${totalCloneDuration >= 10
                                    ? 'bg-[#78d2e6] hover:bg-[#64c0d4] text-white shadow-xs active:scale-95'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                    }`}
                              >
                                 Tiáº¿p theo
                                 <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                           )}

                           {createStep === 'info' && (
                              <button
                                 onClick={handleSaveInstantClone}
                                 disabled={isSavingVoice || !newVoiceName.trim()}
                                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${!isSavingVoice && newVoiceName.trim()
                                    ? 'bg-[#78d2e6] hover:bg-[#64c0d4] text-white shadow-xs active:scale-95'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                    }`}
                              >
                                 {isSavingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Báº¯t Ä‘áº§u nhÃ¢n báº£n'}
                              </button>
                           )}

                           {createStep === 'design' && (
                              <button
                                 onClick={handleSaveDesignedVoice}
                                 disabled={isSavingVoice || !newVoiceName.trim() || !designPreviewVoiceId}
                                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${!isSavingVoice && newVoiceName.trim() && designPreviewVoiceId
                                    ? 'bg-[#78d2e6] hover:bg-[#64c0d4] text-white shadow-xs active:scale-95'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                    }`}
                              >
                                 {isSavingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'LÆ°u giá»ng nÃ³i'}
                              </button>
                           )}
                        </>
                     ) : (
                        <button
                           onClick={() => setIsCreateModalOpen(false)}
                           className="w-full py-2.5 bg-[#78d2e6] hover:bg-[#64c0d4] text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                        >
                           ÄÃ³ng vÃ  sá»­ dá»¥ng
                        </button>
                     )}
                  </div>

               </div>
            </div>
         )}

      </div>
   );
}
