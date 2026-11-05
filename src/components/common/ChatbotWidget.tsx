import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Bot, Building2, ChartNoAxesCombined, ClipboardList, FileImage, FileText, History, Image, Maximize2, MessageSquare, MessageSquarePlus, Mic, MicOff, Minimize2, Music2, NotebookPen, PanelLeftClose, PanelLeftOpen, Paperclip, Presentation, RefreshCw, SendHorizontal, Settings2, UserRoundPlus, Video, Volume2, VolumeX, WandSparkles, X } from "lucide-react";
import { assistantService, type AssistantConversationCursor, type AssistantConversationSummary, type AssistantTurnInput } from "../../services/assistantService";
import { defaultAssistantSettings, type AssistantSettings, type AssistantTableAttachment } from "../../shared/assistant-workflow";
import { AssistantSettingsEditor } from "./AssistantSettingsEditor";
import { AssistantMemoryManager } from "./AssistantMemoryManager";
import "./ChatbotWidget.css";
import type { AssistantReply } from "../../shared/assistant-workflow";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import { getPosTerminalId } from "../../modules/retail/posTerminal";
import { AssistantWorkflowEditor } from "./AssistantWorkflowEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { AssistantSidebarIcon, type AssistantSidebarIconName } from "./AssistantSidebarIcon";
import { cn } from "../../modules/student-management/lib/utils";
import { readAssistantTableFile } from "./assistant-table-file";
import { AssistantTrainingContentForm } from "./AssistantTrainingContentForm";

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance; }
type SpeechRecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEvent = { error: string };
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
type VoiceStatus = "off" | "manual" | "waiting" | "command";

interface Message {
  role: "user" | "assistant";
  content: string;
}
type AssistantMode = "work" | "qa";

function AssistantModeSwitcher({ assistantMode, disabled, onChange, placement }: {
  assistantMode: AssistantMode;
  disabled: boolean;
  onChange: (mode: AssistantMode) => void;
  placement: "sidebar" | "mobile";
}) {
  const options = [
    { mode: "work" as const, label: "Thao tác", Icon: ClipboardList },
    { mode: "qa" as const, label: "Hỏi đáp", Icon: MessageSquare },
  ];
  const isSidebar = placement === "sidebar";

  return <div role="group" aria-label="Chế độ trợ lý" className={isSidebar ? "ml-3 flex flex-col gap-1 border-l border-outline-variant pl-2" : "assistant-mobile-assistant-mode flex shrink-0 gap-1 border-b border-outline-variant bg-surface-container-lowest p-2 sm:justify-center"}>
    {options.map(({ mode, label, Icon }) => <button key={mode} type="button" aria-pressed={assistantMode === mode} disabled={disabled} onClick={() => onChange(mode)} className={cn(isSidebar ? "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm" : "min-h-10 min-w-0 flex-1 rounded-xl px-3 py-2 text-sm sm:max-w-56", assistantMode === mode && "bg-surface-container-high font-semibold", focusClass, "disabled:cursor-not-allowed disabled:opacity-50")}>
      <span className="inline-flex items-center justify-center gap-2"><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</span>
    </button>)}
  </div>;
}

const welcomeMessage: Message = {
  role: "assistant",
  content: "Chào bạn! Mình là trợ lý AI của iGen ERP. Mình có thể trả lời câu hỏi thông thường và hỗ trợ tra cứu, tạo hoặc cập nhật dữ liệu qua các workflow được bật. Với thao tác dữ liệu, mình sẽ hỏi thêm nếu thiếu thông tin và xin bạn xác nhận trước khi thay đổi.",
};
const qaWelcomeMessage: Message = {
  role: "assistant",
  content: "Chào bạn! Đây là tab Hỏi đáp. Bạn có thể hỏi kiến thức, nhờ giải thích, viết, tóm tắt hoặc lên ý tưởng. Nội dung ở đây không truy cập hay thay đổi dữ liệu trong iGen ERP.",
};
const suggestions = [
  { prompt: "Thêm nhân sự mới", category: "Nhân sự", Icon: UserRoundPlus },
  { prompt: "Tạo khách hàng mới", category: "Khách hàng", Icon: Building2 },
  { prompt: "Tạo một công việc mới", category: "Công việc", Icon: ClipboardList },
];
const qaSuggestions = [
  { prompt: "Giải thích AI tạo sinh hoạt động thế nào", category: "Giải thích", Icon: MessageSquare },
  { prompt: "Tóm tắt các ý chính của một văn bản", category: "Tóm tắt", Icon: ClipboardList },
  { prompt: "Lên kế hoạch học một kỹ năng mới", category: "Lên kế hoạch", Icon: ArrowUpRight },
];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
function commandAfterWakeWord(text: string): string | null {
  const match = /\b(?:hey|hei)[,\s]+(?:i\s*gen|ai\s*gen)\b[,:.!?]?\s*/i.exec(text);
  return match ? text.slice(match.index + match[0].length).trim() : null;
}
function chooseVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vietnamese = voices.filter(voice => /^vi(?:-|$)/i.test(voice.lang));
  return vietnamese.find(voice => /^vi-VN$/i.test(voice.lang) && voice.default)
    || vietnamese.find(voice => /^vi-VN$/i.test(voice.lang))
    || vietnamese.find(voice => voice.default)
    || vietnamese[0]
    || null;
}
function waitForVietnameseVoice(synthesis: SpeechSynthesis, signal: AbortSignal): Promise<SpeechSynthesisVoice | null> {
  const voices = synthesis.getVoices();
  const available = chooseVietnameseVoice(voices);
  if (available || signal.aborted) return Promise.resolve(available);
  return new Promise(resolve => {
    let timeout: number | null = null;
    let settled = false;
    const finish = (voice: SpeechSynthesisVoice | null) => {
      if (settled) return;
      settled = true;
      if (timeout !== null) window.clearTimeout(timeout);
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      signal.removeEventListener("abort", onAbort);
      resolve(voice);
    };
    const onVoicesChanged = () => {
      const voice = chooseVietnameseVoice(synthesis.getVoices());
      if (voice) finish(voice);
    };
    const onAbort = () => finish(null);
    synthesis.addEventListener("voiceschanged", onVoicesChanged);
    signal.addEventListener("abort", onAbort, { once: true });
    timeout = window.setTimeout(() => finish(chooseVietnameseVoice(synthesis.getVoices())), 1200);
    onVoicesChanged();
  });
}
function splitSpeechText(text: string, maxLength = 220): string[] {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/gu) || [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const normalized = sentence.trim();
    if (!normalized) continue;
    if (normalized.length <= maxLength) {
      if (current && current.length + normalized.length + 1 > maxLength) {
        chunks.push(current);
        current = normalized;
      } else {
        current = current ? current + " " + normalized : normalized;
      }
      continue;
    }
    if (current) chunks.push(current);
    current = "";
    for (const word of normalized.split(/\s+/u)) {
      if (current && current.length + word.length + 1 > maxLength) {
        chunks.push(current);
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
type LauncherPosition = { x: number; y: number };

function AssistantGradientIcon({ Icon, from = "#00adfc", to = "#7567ff", className = "size-6" }: { Icon: LucideIcon; from?: string; to?: string; className?: string }) {
  const gradientId = useId().replace(/:/g, "");
  return <Icon className={cn(className, "shrink-0")} strokeWidth={2} stroke={`url(#${gradientId})`} aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor={from} /><stop offset="55%" stopColor="#199bff" /><stop offset="100%" stopColor={to} /></linearGradient></defs>
  </Icon>;
}

function AssistantRailIcon({ name }: { name: AssistantSidebarIconName }) {
  return <span className="assistant-side-icon" aria-hidden="true"><AssistantSidebarIcon name={name} /></span>;
}

function AssistantLiveVoiceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true" focusable="false">
    <path d="M6.5 4.5h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H10l-5 3v-4a3 3 0 0 1-1.5-2.6V7.5a3 3 0 0 1 3-3Z" />
    <path d="M7.5 11.5h1.2l1.3-2.2 1.8 4.4 1.8-4.4 1.3 2.2h1.6" />
  </svg>;
}
function clampLauncherPosition(position: LauncherPosition, size = 56): LauncherPosition {
  const margin = 8;
  return {
    x: Math.max(margin, Math.min(position.x, window.innerWidth - size - margin)),
    y: Math.max(margin, Math.min(position.y, window.innerHeight - size - margin)),
  };
}

function readLauncherPosition(key: string): LauncherPosition | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && typeof saved === "object" && "x" in saved && "y" in saved
      && typeof saved.x === "number" && typeof saved.y === "number"
      && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return clampLauncherPosition({ x: saved.x, y: saved.y });
    }
  } catch { /* Keep the default corner when storage is unavailable. */ }
  return null;
}

function readHistory(key: string, welcome = welcomeMessage): Message[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(saved) && saved.length && saved.every((message) =>
      message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")) {
      return saved;
    }
  } catch { /* Storage may be unavailable; chat still works for this session. */ }
  return [welcome];
}

function storedAssistantMode(scope: string): AssistantMode {
  try { return localStorage.getItem(`igen_erp_chatbot_mode:${scope}`) === "qa" ? "qa" : "work"; }
  catch { return "work"; }
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function ChatbotWidget({ storageScope, mode = "popup" }: { storageScope: string; mode?: "popup" | "standalone" }) {
  const { userProfile } = useAuth();
  const branch = useBranchOptional();
  const scope = `${storageScope}:${branch?.activeBranchId || "company"}`;
  const branchId = branch?.activeBranchId || "";
  const deviceId = userProfile?.companyCode && branchId ? getPosTerminalId(userProfile.companyCode, branchId) : undefined;
  return <ChatbotModeShell key={`${scope}:${mode}`} storageScope={scope} launcherStorageScope={storageScope} branchId={branchId} deviceId={deviceId} mode={mode} />;
}

function ChatbotModeShell({ storageScope, launcherStorageScope, branchId, deviceId, mode }: { storageScope: string; launcherStorageScope: string; branchId: string; deviceId?: string; mode: "popup" | "standalone" }) {
  const [assistantMode, setAssistantMode] = useState<AssistantMode>(() => storedAssistantMode(storageScope));
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
  const setAssistantModeAndConversation = (nextMode: AssistantMode, conversationId?: string) => {
    setAssistantMode(nextMode);
    setInitialConversationId(conversationId || null);
    try { localStorage.setItem(`igen_erp_chatbot_mode:${storageScope}`, nextMode); } catch { /* Keep this preference in memory. */ }
  };
  return <ChatbotSession
    key={`${storageScope}:${mode}`}
    storageScope={storageScope}
    launcherStorageScope={launcherStorageScope}
    branchId={branchId}
    deviceId={deviceId}
    mode={mode}
    assistantMode={assistantMode}
    initialConversationId={initialConversationId}
    onAssistantModeChange={setAssistantModeAndConversation}
  />;
}

function storedConversation(key: string): string {
  try { const saved = localStorage.getItem(key); if (saved && /^[a-f\d-]{36}$/i.test(saved)) return saved; } catch { /* Use this session. */ }
  const id = crypto.randomUUID();
  try { localStorage.setItem(key, id); } catch { /* Use this session. */ }
  return id;
}

function ChatbotSession({ storageScope, launcherStorageScope, branchId, deviceId, mode, assistantMode, initialConversationId, onAssistantModeChange }: { storageScope: string; launcherStorageScope: string; branchId: string; deviceId?: string; mode: "popup" | "standalone"; assistantMode: AssistantMode; initialConversationId: string | null; onAssistantModeChange: (mode: AssistantMode, conversationId?: string) => void }) {
  const { userProfile } = useAuth();
  const railGradientId = useId().replace(/:/g, "");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const launcherStorageKey = `igen_erp_chatbot_launcher_position:${launcherStorageScope}`;
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition | null>(() => mode === "popup" ? readLauncherPosition(launcherStorageKey) : null);
  const launcherPositionRef = useRef(launcherPosition);
  const launcherDragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressLauncherClickRef = useRef(false);
  useEffect(() => {
    if (mode !== "popup") return;
    const keepLauncherInViewport = () => {
      if (!launcherPositionRef.current) return;
      const position = clampLauncherPosition(launcherPositionRef.current, launcherRef.current?.offsetWidth || 56);
      launcherPositionRef.current = position;
      setLauncherPosition(position);
    };
    window.addEventListener("resize", keepLauncherInViewport);
    return () => window.removeEventListener("resize", keepLauncherInViewport);
  }, [mode]);
  const moveLauncher = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    event.preventDefault();
    const position = clampLauncherPosition({ x: drag.left + dx, y: drag.top + dy }, event.currentTarget.offsetWidth);
    launcherPositionRef.current = position;
    setLauncherPosition(position);
  };
  const finishLauncherDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = launcherDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    launcherDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;
    suppressLauncherClickRef.current = true;
    window.setTimeout(() => { suppressLauncherClickRef.current = false; }, 0);
    try { localStorage.setItem(launcherStorageKey, JSON.stringify(launcherPositionRef.current)); } catch { /* Dragging still works for this session. */ }
  };
  const storageBaseKey = `igen_erp_chatbot_history:${storageScope}`;
  const storageKey = assistantMode === "work" ? storageBaseKey : `${storageBaseKey}:qa`;
  const conversationKey = `${storageKey}:conversation`;
  const requestKey = `${storageKey}:request`;
  const draftKey = `${storageKey}:draft`;
  const activeWelcomeMessage = assistantMode === "qa" ? qaWelcomeMessage : welcomeMessage;
  const [conversationId, setConversationId] = useState(() => initialConversationId || storedConversation(conversationKey));
  const [settings, setSettings] = useState<AssistantSettings>(defaultAssistantSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsRetry, setSettingsRetry] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [configView, setConfigView] = useState<"workflows" | "settings" | "memory">("workflows");
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setSettingsError("");
    void assistantService.settings(controller.signal).then(value => {
      if (!controller.signal.aborted) { setSettings(value); setFullscreen(value.windowMode === "fullscreen"); setSettingsReady(true); }
    }).catch(cause => { if (!controller.signal.aborted) setSettingsError((cause as Error).message); });
    return () => controller.abort();
  }, [settingsRetry]);
  const [password, setPassword] = useState("");
  const [view, setView] = useState<"chat" | "history">("chat");
  const [isViewingHistory, setIsViewingHistory] = useState(Boolean(initialConversationId));
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [historyCursor, setHistoryCursor] = useState<AssistantConversationCursor | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyReload, setHistoryReload] = useState(0);
  const [lastReply, setLastReply] = useState<AssistantReply | null>(null);
  const [selectedReferences, setSelectedReferences] = useState<Record<string, string[]>>({});
  const [referenceSelectionError, setReferenceSelectionError] = useState("");
  const [workflowsVisited, setWorkflowsVisited] = useState(false);
  const [synced, setSynced] = useState(false);
  const retryRef = useRef<AssistantTurnInput | null>(null);
  const [isOpen, setIsOpen] = useState(mode === "standalone");
  const [input, setInputState] = useState(() => {
    try { return localStorage.getItem(draftKey) || ""; } catch { return ""; }
  });
  const setInput: React.Dispatch<React.SetStateAction<string>> = nextValue => setInputState(current => {
    const next = typeof nextValue === "function" ? nextValue(current) : nextValue;
    try { if (next) localStorage.setItem(draftKey, next); else localStorage.removeItem(draftKey); } catch { /* Keep the draft in memory. */ }
    return next;
  });
  const [attachment, setAttachment] = useState<AssistantTableAttachment | null>(null);
  const [attachmentSubmitted, setAttachmentSubmitted] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [isReadingAttachment, setIsReadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("off");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechBaseRef = useRef("");
  const voiceStatusRef = useRef<VoiceStatus>("off");
  const commandTextRef = useRef("");
  const commandResultIndexRef = useRef<number | null>(null);
  const voiceSilenceTimerRef = useRef<number | null>(null);
  const recognizedVoiceHandlerRef = useRef<(text: string) => void>(() => undefined);
  const [wakeRestartVersion, setWakeRestartVersion] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const speechUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const speechRequestRef = useRef<AbortController | null>(null);
  const speechRunIdRef = useRef(0);
  useEffect(() => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    if (isSettingsDialogOpen && !dialog.open) dialog.showModal();
    else if (!isSettingsDialogOpen && dialog.open) dialog.close();
  }, [isSettingsDialogOpen]);
  const closeSpeech = useCallback(() => {
    if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
    voiceSilenceTimerRef.current = null;
    voiceStatusRef.current = "off";
    commandTextRef.current = "";
    commandResultIndexRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) recognition.abort();
    setIsListening(false);
    setVoiceStatus("off");
    setWakeRestartVersion(value => value + 1);
  }, []);
  const stopReplySpeech = useCallback(() => {
    speechRunIdRef.current += 1;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    speechUtterancesRef.current.forEach(utterance => { utterance.onend = null; utterance.onerror = null; });
    speechUtterancesRef.current = [];
    speechSynthesisRef.current?.cancel();
    speechSynthesisRef.current = null;
    setIsSpeaking(false);
  }, []);
  const speakReply = useCallback(async (text: string) => {
    if (!settings.speakReplies) return;
    stopReplySpeech();
    const synthesis = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setSpeechError("Trình duyệt này chưa hỗ trợ đọc câu trả lời thành tiếng.");
      return;
    }
    const runId = speechRunIdRef.current;
    const controller = new AbortController();
    speechRequestRef.current = controller;
    setSpeechError("");
    setIsSpeaking(true);
    speechSynthesisRef.current = synthesis;
    const finish = () => {
      if (runId !== speechRunIdRef.current) return;
      speechRequestRef.current = null;
      speechUtterancesRef.current = [];
      speechSynthesisRef.current = null;
      setIsSpeaking(false);
    };
    try {
      const voice = await waitForVietnameseVoice(synthesis, controller.signal);
      if (controller.signal.aborted || runId !== speechRunIdRef.current) return;
      if (!voice) throw new Error("Thiết bị chưa có giọng đọc tiếng Việt. Hãy thêm giọng tiếng Việt trong cài đặt hệ điều hành hoặc trình duyệt.");
      const utterances = splitSpeechText(text).map(chunk => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = voice.lang || "vi-VN";
        utterance.voice = voice;
        utterance.rate = 1;
        utterance.pitch = 1;
        return utterance;
      });
      speechUtterancesRef.current = utterances;
      const failPlayback = () => {
        if (runId !== speechRunIdRef.current) return;
        speechRunIdRef.current += 1;
        speechRequestRef.current = null;
        speechUtterancesRef.current = [];
        speechSynthesisRef.current?.cancel();
        speechSynthesisRef.current = null;
        setIsSpeaking(false);
        setSpeechError("Không thể phát giọng đọc tiếng Việt trên thiết bị này.");
      };
      const speakNext = (index: number) => {
        if (controller.signal.aborted || runId !== speechRunIdRef.current) return;
        const utterance = utterances[index];
        if (!utterance) { finish(); return; }
        utterance.onend = () => speakNext(index + 1);
        utterance.onerror = failPlayback;
        try { synthesis.speak(utterance); } catch { failPlayback(); }
      };
      if (!utterances.length) { finish(); return; }
      speakNext(0);
    } catch (cause) {
      if (!controller.signal.aborted && runId === speechRunIdRef.current) {
        speechRequestRef.current = null;
        speechUtterancesRef.current = [];
        speechSynthesisRef.current = null;
        setIsSpeaking(false);
        setSpeechError((cause as Error).message || "Không thể đọc câu trả lời thành tiếng.");
      }
    }
  }, [settings.speakReplies, stopReplySpeech]);
  const applySettings = (value: AssistantSettings) => {
    setSettings(value);
    setFullscreen(value.windowMode === "fullscreen");
    if (!value.speakReplies) { stopReplySpeech(); setSpeechError(""); }
  };
  const [messages, setMessages] = useState<Message[]>(() => readHistory(storageKey, activeWelcomeMessage));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const historyBannerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resumeFocusRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const previousAssistantModeRef = useRef(assistantMode);
  const closeConfirmation = useCallback(() => setShowConfirmClear(false), []);

  useEffect(() => () => {
    requestRef.current?.abort();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
    voiceSilenceTimerRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    speechRunIdRef.current += 1;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    speechUtterancesRef.current.forEach(utterance => { utterance.onend = null; utterance.onerror = null; });
    speechUtterancesRef.current = [];
    window.speechSynthesis?.cancel();
    speechSynthesisRef.current = null;
  }, []);
  useEffect(() => {
    const onlyWelcome = messages.length === 1 && messages[0].role === "assistant" && messages[0].content === welcomeMessage.content;
    if (isOpen && !onlyWelcome && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isLoading, isOpen]);

  const saveHistory = (next: Message[], persist = !isViewingHistory) => {
    setMessages(next);
    if (!persist) return;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep in memory. */ }
  };

  useEffect(() => {
    if (previousAssistantModeRef.current === assistantMode) return;
    previousAssistantModeRef.current = assistantMode;
    closeSpeech();
    stopReplySpeech();
    closeConfirmation();
    const nextStorageKey = assistantMode === "work" ? storageBaseKey : `${storageBaseKey}:qa`;
    const nextConversationKey = `${nextStorageKey}:conversation`;
    setConversationId(storedConversation(nextConversationKey));
    setMessages(readHistory(nextStorageKey, activeWelcomeMessage));
    try { setInput(localStorage.getItem(`${nextStorageKey}:draft`) || ""); } catch { setInput(""); }
    setIsViewingHistory(false);
    setSynced(false);
    setLastReply(null);
    setSelectedReferences({});
    setReferenceSelectionError("");
    setPassword("");
    setAttachmentError("");
    setError("");
    setVoiceError("");
    setView("chat");
  }, [assistantMode]);

  useEffect(() => {
    if (!initialConversationId) return;
    setIsViewingHistory(true);
    setConversationId(initialConversationId);
    setSynced(false);
    setLastReply(null);
    setSelectedReferences({});
    setReferenceSelectionError("");
    setPassword("");
    setInput("");
    setAttachmentError("");
    setError("");
    setView("chat");
  }, [initialConversationId]);

  const submitTurn = async (request: AssistantTurnInput) => {
    if (requestRef.current) return;
    const turnRequest: AssistantTurnInput = { ...request, mode: assistantMode };
    const controller = new AbortController();
    requestRef.current = controller;
    retryRef.current = turnRequest;
    try {
      if (turnRequest.attachment) localStorage.removeItem(requestKey);
      else localStorage.setItem(requestKey, JSON.stringify({ ...turnRequest, decision: turnRequest.decision ? { id: turnRequest.decision.id, confirmed: turnRequest.decision.confirmed } : undefined }));
    } catch { /* Keep in memory. */ }
    setError(""); setIsLoading(true);
    try {
      let result = await assistantService.turn(turnRequest, controller.signal, branchId, deviceId);
      for (let attempt = 0; result.status === "processing" && attempt < 40 && !controller.signal.aborted; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (controller.signal.aborted) return;
        result = await assistantService.turn(turnRequest, controller.signal, branchId, deviceId);
      }
      if (result.status === "processing") throw new Error("Yêu cầu vẫn đang xử lý. Bấm kiểm tra lại để lấy kết quả của cùng yêu cầu, tránh tạo trùng.");
      if (controller.signal.aborted) return;
      setLastReply(result);
      setSelectedReferences({});
      setReferenceSelectionError("");
      speakReply(result.reply);
      setPassword("");
      if (turnRequest.mode === "work" && (result.status === "completed" || result.status === "cancelled")) {
        setAttachment(null);
        setAttachmentSubmitted(false);
      } else if (turnRequest.mode === "work" && turnRequest.attachment && result.status !== "unsupported" && result.status !== "failed") {
        setAttachmentSubmitted(true);
      }
      setSynced(true);
      setMessages(current => {
        const next: Message[] = current[current.length - 1]?.content === result.reply ? current : [...current, { role: "assistant", content: result.reply }];
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep in memory. */ }
        return next;
      });
      retryRef.current = null;
      try { localStorage.removeItem(requestKey); } catch { /* Keep in memory. */ }
    } catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message); }
    finally { if (!controller.signal.aborted) setIsLoading(false); requestRef.current = null; }
  };

  useEffect(() => {
    if (!isOpen || synced) return;
    const controller = new AbortController();
    setIsLoading(true); setError("");
    void assistantService.state(conversationId, controller.signal, branchId).then(state => {
      if (controller.signal.aborted) return;
      saveHistory(state.messages.length ? state.messages : [activeWelcomeMessage], !isViewingHistory);
      setLastReply(isViewingHistory ? null : state.lastReply);
      setSynced(!state.busy);
      setIsLoading(false);
      try {
        const pending = JSON.parse(localStorage.getItem(requestKey) || "null") as AssistantTurnInput | null;
        if (!isViewingHistory && pending?.conversationId === conversationId && pending.requestId) void submitTurn(pending);
        else if (state.busy && !isViewingHistory) setError("Một yêu cầu của cuộc trò chuyện đang xử lý. Hãy mở lại sau khi hoàn tất; không gửi lặp yêu cầu.");
      } catch { /* Ignore damaged saved requests. */ }
    }).catch(cause => { if (!controller.signal.aborted) { setError((cause as Error).message); setIsLoading(false); } });
    return () => controller.abort();
  }, [isOpen, synced, conversationId, isViewingHistory, branchId]);

  useEffect(() => {
    if (view !== "history") return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    setConversations([]);
    setHistoryCursor(null);
    void assistantService.conversations(undefined, controller.signal, branchId).then(page => {
      if (controller.signal.aborted) return;
      setConversations(page.items);
      setHistoryCursor(page.nextCursor);
    }).catch(cause => {
      if (!controller.signal.aborted) setHistoryError((cause as Error).message);
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [view, historyReload, branchId]);

  useEffect(() => {
    if (view !== "chat") return;
    if (isViewingHistory) historyBannerRef.current?.focus({ preventScroll: true });
    else if (resumeFocusRef.current) { resumeFocusRef.current = false; inputRef.current?.focus({ preventScroll: true }); }
  }, [view, isViewingHistory, conversationId]);

  const loadOlderConversations = async () => {
    if (!historyCursor || historyLoadingMore) return;
    setHistoryLoadingMore(true);
    setHistoryError("");
    try {
      const page = await assistantService.conversations(historyCursor, undefined, branchId);
      setConversations(current => [...current, ...page.items]);
      setHistoryCursor(page.nextCursor);
    } catch (cause) {
      setHistoryError((cause as Error).message);
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  const openPreviousConversation = (conversation: AssistantConversationSummary) => {
    if (isLoading || retryRef.current) return;
    closeSpeech();
    stopReplySpeech();
    onAssistantModeChange(conversation.mode === "qa" ? "qa" : "work", conversation.conversationId);
  };

  const continuePreviousConversation = () => {
    if (isLoading || retryRef.current) return;
    try { localStorage.setItem(conversationKey, conversationId); } catch { /* Keep this session active in memory. */ }
    closeSpeech();
    stopReplySpeech();
    resumeFocusRef.current = true;
    setIsViewingHistory(false);
    setSynced(false);
    setLastReply(null);
    setSelectedReferences({});
    setReferenceSelectionError("");
    onAssistantModeChange(assistantMode);
  };

  const handleSend = async (textToSend = input) => {
    const text = textToSend.trim();
    if (isViewingHistory || !text || isLoading || !synced || isListening || isReadingAttachment || retryRef.current) return;
    stopReplySpeech();
    const pendingAttachment = assistantMode === "work" && attachment && !attachmentSubmitted ? attachment : undefined;
    saveHistory([...messages, { role: "user", content: `${text}${pendingAttachment ? `\n📎 ${pendingAttachment.fileName} · ${pendingAttachment.rows.length} dòng` : ""}` }]);
    setInput(""); setLastReply(null); setSelectedReferences({}); setReferenceSelectionError(""); setVoiceError("");
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, text, ...(pendingAttachment ? { attachment: pendingAttachment } : {}) });
  };
  const submitRecognizedVoice = async (recognizedText: string) => {
    const text = recognizedText.trim();
    if (isViewingHistory || !text || isLoading || !synced || isReadingAttachment || retryRef.current) return;
    stopReplySpeech();
    const pendingAttachment = assistantMode === "work" && attachment && !attachmentSubmitted ? attachment : undefined;
    saveHistory([...messages, { role: "user", content: `${text}${pendingAttachment ? `\n📎 ${pendingAttachment.fileName} · ${pendingAttachment.rows.length} dòng` : ""}` }]);
    setInput(""); setLastReply(null); setSelectedReferences({}); setReferenceSelectionError(""); setVoiceError("");
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, text, ...(pendingAttachment ? { attachment: pendingAttachment } : {}) });
  };
  recognizedVoiceHandlerRef.current = text => { void submitRecognizedVoice(text); };
  const toggleReferenceSelection = (key: string, value: string, checked: boolean, multiple: boolean) => {
    setSelectedReferences(current => {
      const selected = current[key] || [];
      const next = multiple
        ? checked ? [...new Set([...selected, value])] : selected.filter(item => item !== value)
        : checked ? [value] : [];
      return { ...current, [key]: next };
    });
    setReferenceSelectionError("");
  };
  const submitReferenceSelections = async () => {
    const groups = lastReply?.referenceSelections || [];
    if (isViewingHistory || !groups.length || isLoading || !synced || retryRef.current) return;
    const missing = groups.find(group => group.required && !selectedReferences[group.key]?.length);
    if (missing) {
      setReferenceSelectionError(`Bạn chọn giúp mình ${missing.label} để tiếp tục.`);
      return;
    }
    stopReplySpeech();
    const referenceSelections = Object.fromEntries(groups.flatMap(group => {
      const values = selectedReferences[group.key] || [];
      return values.length ? [[group.key, values]] : [];
    }));
    const skipReferenceKeys = groups.filter(group => !group.required && !selectedReferences[group.key]?.length).map(group => group.key);
    const selectedSummary = groups.flatMap(group => {
      const values = selectedReferences[group.key] || [];
      return values.length ? [`${group.label}: ${values.map(value => group.options.find(option => option.value === value)?.label || value).join(", ")}`] : [];
    });
    const skippedLabels = groups.filter(group => skipReferenceKeys.includes(group.key)).map(group => group.label);
    const userContent = [selectedSummary.length ? `Mình chọn ${selectedSummary.join("; ")}.` : "Mình tiếp tục mà không chọn thêm mục nào.", skippedLabels.length ? `Đã bỏ qua: ${skippedLabels.join(", ")}.` : ""].filter(Boolean).join("\n");
    saveHistory([...messages, { role: "user", content: userContent }]);
    setLastReply(null);
    setSelectedReferences({});
    setReferenceSelectionError("");
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, referenceSelections, skipReferenceKeys });
  };
  const submitTrainingContent = async (trainingContent: AssistantTurnInput["trainingContent"]) => {
    if (!trainingContent || !lastReply?.trainingContentForm || isViewingHistory || isLoading || !synced || retryRef.current) return;
    stopReplySpeech();
    const summary = `Đã nhập ${trainingContent.lessons.length} bài giảng và ${trainingContent.quizzes.length} câu hỏi trắc nghiệm.`;
    saveHistory([...messages, { role: "user", content: summary }]);
    setLastReply(null);
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, trainingContent });
  };
  const selectAttachment = async (file?: File) => {
    if (!file) return;
    setAttachmentError(""); setIsReadingAttachment(true);
    try {
      setAttachment(await readAssistantTableFile(file));
      setAttachmentSubmitted(false);
    } catch (cause) {
      setAttachment(null); setAttachmentSubmitted(false);
      setAttachmentError((cause as Error).message || "Mình chưa đọc được tệp này.");
    } finally {
      setIsReadingAttachment(false);
      attachmentButtonRef.current?.focus({ preventScroll: true });
    }
  };
  const removeAttachment = () => {
    setAttachment(null); setAttachmentSubmitted(false); setAttachmentError("");
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    attachmentButtonRef.current?.focus({ preventScroll: true });
  };
  const toggleVoiceInput = () => {
    if (recognitionRef.current && voiceStatusRef.current === "waiting") {
      closeSpeech();
      setWorkflowsVisited(true);
      setConfigView("settings");
      setIsSettingsDialogOpen(true);
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Trình duyệt này chưa hỗ trợ nhận giọng nói. Bạn vẫn có thể nhập yêu cầu bằng bàn phím.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    voiceStatusRef.current = "manual";
    setVoiceStatus("manual");
    speechBaseRef.current = input.trimEnd();
    setVoiceError("");
    setIsListening(true);
    recognition.onstart = () => setVoiceError("");
    recognition.onresult = event => {
      if (recognitionRef.current !== recognition) return;
      const finalParts: string[] = [];
      const interimParts: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const transcript = event.results[index][0].transcript.trim();
        if (!transcript) continue;
        (event.results[index].isFinal ? finalParts : interimParts).push(transcript);
      }
      const transcript = [...finalParts, ...interimParts].join(" ");
      setInput([speechBaseRef.current, transcript].filter(Boolean).join(speechBaseRef.current ? " " : ""));
    };
    recognition.onerror = event => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "aborted") return;
      setIsListening(false);
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      recognitionRef.current = null;
      const messages: Record<string, string> = {
        "not-allowed": "Micro chưa được cấp quyền. Hãy cho phép trình duyệt dùng micro rồi thử lại.",
        "service-not-allowed": "Dịch vụ nhận giọng nói của trình duyệt không được phép sử dụng.",
        "audio-capture": "Không tìm thấy micro. Hãy kết nối micro hoặc nhập yêu cầu bằng bàn phím.",
        "no-speech": "Chưa nghe rõ lời nói. Hãy thử lại hoặc nhập yêu cầu bằng bàn phím.",
        network: "Không kết nối được dịch vụ nhận giọng nói. Nội dung đã ghi nhận vẫn được giữ.",
      };
      setVoiceError(messages[event.error] || "Không nhận diện được giọng nói. Nội dung đã nhập vẫn được giữ.");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setIsListening(false);
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      setInput(current => current.trim() ? current : speechBaseRef.current);
    };
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setIsListening(false);
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      setVoiceError("Không thể bắt đầu nhận giọng nói. Hãy thử lại hoặc nhập yêu cầu bằng bàn phím.");
    }
  };
  useEffect(() => {
    if (!settingsReady || !settings.wakeWordEnabled || isLoading || isSpeaking || isViewingHistory || view !== "chat" || isSettingsDialogOpen) return;
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Trình duyệt này chưa hỗ trợ nghe từ khóa “Hey Igen”. Bạn có thể dùng nút micro để đọc yêu cầu.");
      return;
    }
    let active = true;
    let paused = false;
    let restartTimer: number | null = null;
    const cancelCommandTimer = () => {
      if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
    };
    const submitCommand = () => {
      const text = commandTextRef.current.trim();
      cancelCommandTimer();
      if (!text) return;
      const current = recognitionRef.current;
      recognitionRef.current = null;
      voiceStatusRef.current = "off";
      commandTextRef.current = "";
      commandResultIndexRef.current = null;
      setVoiceStatus("off");
      setIsListening(false);
      setWakeRestartVersion(value => value + 1);
      setInput(text);
      current?.stop();
      recognizedVoiceHandlerRef.current(text);
    };
    const scheduleCommand = () => {
      cancelCommandTimer();
      if (!commandTextRef.current.trim()) return;
      voiceSilenceTimerRef.current = window.setTimeout(submitCommand, 1400);
    };
    const openChat = () => {
      if (mode !== "popup") return;
      const panel = document.getElementById("erp-chatbot-panel") as (HTMLElement & { showPopover?: () => void }) | null;
      if (!panel) return;
      try { if (!panel.matches(":popover-open")) panel.showPopover?.(); } catch { /* The launcher remains available if popovers are unsupported. */ }
    };
    const begin = () => {
      if (!active || paused || recognitionRef.current) return;
      const recognition = new SpeechRecognition();
      recognition.lang = "vi-VN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
      voiceStatusRef.current = "waiting";
      setVoiceStatus("waiting");
      setIsListening(false);
      recognition.onstart = () => setVoiceError("");
      recognition.onresult = event => {
        if (!active || recognitionRef.current !== recognition) return;
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          const transcript = result[0].transcript.trim();
          if (!transcript) continue;
          if (voiceStatusRef.current === "waiting") {
            const remainder = commandAfterWakeWord(transcript);
            if (remainder === null) continue;
            voiceStatusRef.current = "command";
            commandTextRef.current = remainder;
            commandResultIndexRef.current = index;
            setVoiceStatus("command");
            setIsListening(true);
            setVoiceError("");
            openChat();
            setInput(remainder);
            if (result.isFinal) {
              commandResultIndexRef.current = null;
              scheduleCommand();
            }
            continue;
          }
          if (voiceStatusRef.current !== "command") continue;
          if (commandResultIndexRef.current === index) {
            const remainder = commandAfterWakeWord(transcript);
            if (remainder !== null) commandTextRef.current = remainder;
            if (result.isFinal) commandResultIndexRef.current = null;
          } else if (result.isFinal) {
            commandTextRef.current = [commandTextRef.current, transcript].filter(Boolean).join(" ");
          } else {
            interim = transcript;
          }
          if (result.isFinal) scheduleCommand();
        }
        if (voiceStatusRef.current === "command") {
          setInput([commandTextRef.current, interim].filter(Boolean).join(" "));
        }
      };
      recognition.onerror = event => {
        if (recognitionRef.current !== recognition || event.error === "aborted") return;
        const messages: Record<string, string> = {
          "not-allowed": "Micro chưa được cấp quyền. Hãy cho phép trình duyệt dùng micro rồi tắt, bật lại tùy chọn “Hey Igen”.",
          "service-not-allowed": "Dịch vụ nhận giọng nói của trình duyệt chưa được phép sử dụng.",
          "audio-capture": "Không tìm thấy micro. Hãy kết nối micro rồi bật lại tùy chọn “Hey Igen”.",
          "no-speech": "",
          network: "Không kết nối được dịch vụ nhận giọng nói. Hãy kiểm tra kết nối rồi bật lại tùy chọn “Hey Igen”.",
        };
        if (["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(event.error)) {
          paused = true;
          recognitionRef.current = null;
          voiceStatusRef.current = "off";
          setVoiceStatus("off");
          setIsListening(false);
          setVoiceError(messages[event.error] || "Không nhận diện được giọng nói.");
        }
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;
        if (!active || paused) return;
        if (voiceStatusRef.current === "command" && commandTextRef.current.trim()) {
          submitCommand();
          return;
        }
        restartTimer = window.setTimeout(begin, 400);
      };
      try { recognition.start(); }
      catch {
        recognitionRef.current = null;
        voiceStatusRef.current = "off";
        setVoiceStatus("off");
        setVoiceError("Không thể bật micro tự động. Hãy kiểm tra quyền micro của trình duyệt rồi thử lại.");
      }
    };
    begin();
    return () => {
      active = false;
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      cancelCommandTimer();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) recognition.abort();
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      setIsListening(false);
    };
  }, [settingsReady, settings.wakeWordEnabled, isLoading, isSpeaking, isViewingHistory, view, isSettingsDialogOpen, mode, wakeRestartVersion]);
  const decide = (confirmed: boolean) => {
    if (isViewingHistory || !lastReply?.action || isLoading || retryRef.current) return;
    stopReplySpeech();
    saveHistory([...messages, { role: "user", content: confirmed ? "Xác nhận thực hiện." : "Hủy thao tác." }]);
    void submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, decision: { id: lastReply.action.id, confirmed, ...(confirmed && lastReply.action.requiresPassword ? { password } : {}) } });
  };
  const startNew = () => {
    const id = crypto.randomUUID();
    try { localStorage.setItem(conversationKey, id); localStorage.removeItem(requestKey); } catch { /* Keep in memory. */ }
    closeSpeech(); stopReplySpeech(); retryRef.current = null; setIsViewingHistory(false); setConversationId(id); setSynced(false); setLastReply(null); saveHistory([activeWelcomeMessage], true); setError(""); setInput(""); setAttachment(null); setAttachmentSubmitted(false); setAttachmentError(""); setVoiceError(""); closeConfirmation();
    onAssistantModeChange(assistantMode);
  };

  const isWelcomeScreen = !isViewingHistory && messages.length === 1 && messages[0].role === "assistant" && messages[0].content === activeWelcomeMessage.content;
  const hasMissingRequiredReferenceSelection = Boolean(lastReply?.referenceSelections?.some(group => group.required && !selectedReferences[group.key]?.length));
  const changeView = (nextView: "chat" | "history") => {
    if (nextView !== "chat") { closeSpeech(); stopReplySpeech(); }
    setView(nextView);
  };
  const openAssistantInput = () => {
    changeView("chat");
    window.requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: 0 });
      inputRef.current?.focus({ preventScroll: true });
    });
  };
  const openSettings = () => {
    closeSpeech(); stopReplySpeech(); setWorkflowsVisited(true); setConfigView("settings"); setIsSettingsDialogOpen(true);
  };
  const returnToPreviousPage = () => {
    closeSpeech(); stopReplySpeech();
    if (window.history.length > 1) window.history.back();
    else {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };
  const renderComposer = (placement: "landing" | "conversation") => <div className={cn("space-y-2", placement === "landing" ? "w-full text-left" : "mx-auto w-full max-w-4xl", mode === "standalone" && placement === "landing" && "assistant-landing-composer-wrap")}>
    {error && <div className="space-y-1">
      <p id="erp-chatbot-error" role="alert" className="text-pretty text-sm text-error">{error}</p>
      <button type="button" onClick={() => { if (retryRef.current) void submitTurn(retryRef.current); else { setSynced(false); if (mode === "popup") { setIsOpen(false); document.getElementById("erp-chatbot-panel")?.hidePopover(); } } }} className={cn("rounded px-2 py-1 text-sm font-medium text-primary underline", focusClass)}>{retryRef.current ? "Kiểm tra lại yêu cầu" : mode === "popup" ? "Đóng và mở lại để tải" : "Thử tải lại"}</button>
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className={cn("rounded-2xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30", placement === "landing" ? "assistant-landing-composer p-3 shadow-sm sm:p-4" : "p-2")}>
      <label className="sr-only" htmlFor="erp-chatbot-input">Tin nhắn cho trợ lý ảo</label>
      <textarea ref={inputRef} id="erp-chatbot-input" rows={placement === "landing" && mode !== "standalone" ? 3 : placement === "landing" ? 3 : 2} autoFocus={mode !== "standalone"} onKeyDown={event => { if (settings.enterToSend && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(); } }} value={input} onChange={(event) => setInput(event.target.value)} placeholder={assistantMode === "qa" ? "Bạn muốn hỏi điều gì?" : mode === "standalone" && placement === "landing" ? "Hỏi tôi bất cứ điều gì" : "Bạn muốn thực hiện việc gì?"} aria-describedby={["erp-chatbot-voice-help", error && "erp-chatbot-error", voiceError && "erp-chatbot-voice-error"].filter(Boolean).join(" ")} className={cn("block w-full min-w-0 border-0 bg-transparent px-2 py-2 text-base text-on-surface placeholder:text-on-surface/60 focus-visible:outline-none focus-visible:ring-0", mode === "standalone" ? "resize-none" : "resize-y", placement === "landing" && "sm:text-lg")} />
      {assistantMode === "work" && <input ref={attachmentInputRef} className="sr-only" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" aria-label="Chọn tệp CSV hoặc Excel" aria-describedby={`erp-chatbot-file-help${attachmentError ? " erp-chatbot-file-error" : ""}`} aria-invalid={Boolean(attachmentError)} tabIndex={-1} onChange={event => { void selectAttachment(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />}
      {assistantMode === "work" && attachment && <div className="mx-1 mb-2 rounded-xl border border-outline-variant bg-surface-container-low p-3">
        <div className="flex min-w-0 items-start gap-2">
          <Paperclip className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="break-all text-sm font-medium text-on-surface">{attachment.fileName}</p>
            <p className="text-xs text-on-surface/70">{attachment.rows.length} dòng · {attachmentSubmitted ? "đã gửi cho trợ lý" : "sẵn sàng gửi"}</p>
          </div>
          <button type="button" onClick={removeAttachment} aria-label={`Xóa tệp ${attachment.fileName}`} title="Xóa tệp" className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container-high", focusClass)}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <details className="mt-2 text-xs text-on-surface/80">
          <summary className={cn("w-fit cursor-pointer rounded-sm py-1 text-primary", focusClass)}>Xem toàn bộ bảng ({attachment.rows.length} dòng)</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
            <table className="min-w-full text-left text-xs">
              <caption className="sr-only">Bảng dữ liệu có {attachment.rows.length} dòng từ {attachment.fileName}</caption>
              <thead className="sticky top-0 bg-surface-container-low text-on-surface"><tr>{attachment.headers.map(header => <th key={header} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">{header}</th>)}</tr></thead>
              <tbody>{attachment.rows.map((row, index) => <tr key={index} className="border-t border-outline-variant">{attachment.headers.map(header => <td key={header} className="max-w-64 whitespace-normal break-words px-2 py-1.5">{row[header]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      </div>}
      {assistantMode === "work" && attachmentError && <p id="erp-chatbot-file-error" role="alert" className="mx-2 mb-2 text-pretty text-sm text-error">{attachmentError}</p>}
      {assistantMode === "work" && isReadingAttachment && <p role="status" className="mx-2 mb-2 text-sm text-on-surface/70">Đang đọc bảng dữ liệu…</p>}
      <div className="assistant-composer-toolbar flex items-center gap-2 border-t border-outline-variant px-1 pt-2">
        {assistantMode === "work" && <button ref={attachmentButtonRef} type="button" aria-label="Đính kèm tệp CSV hoặc Excel" aria-describedby={`erp-chatbot-file-help${attachmentError ? " erp-chatbot-file-error" : ""}`} disabled={isLoading || !synced || isReadingAttachment || Boolean(retryRef.current)} onClick={() => attachmentInputRef.current?.click()} title="Tải bảng CSV hoặc Excel lên" className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
          <Paperclip className="size-5" aria-hidden="true" />
        </button>}
        <button type="button" onClick={toggleVoiceInput} aria-label={voiceStatus === "waiting" ? "Mở cài đặt nghe từ khóa Hey Igen" : isListening ? "Dừng nhận giọng nói" : "Nhập yêu cầu bằng giọng nói"} aria-pressed={voiceStatus === "manual" || voiceStatus === "command"} aria-describedby={voiceError ? "erp-chatbot-voice-error" : "erp-chatbot-voice-help"} disabled={isLoading || !synced || Boolean(retryRef.current)} title={voiceStatus === "waiting" ? "Mở cài đặt để tắt nghe Hey Igen" : isListening ? "Dừng nhận giọng nói" : "Nhập yêu cầu bằng giọng nói"} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
          {isListening ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
        </button>
        {mode === "standalone" && <button type="button" disabled aria-label="Trò chuyện thoại trực tiếp với AI (chưa có)" title="Trò chuyện thoại trực tiếp với AI (chưa có)" className="assistant-composer-tool flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface text-on-surface disabled:cursor-not-allowed disabled:opacity-40"><AssistantLiveVoiceIcon /></button>}
        {mode !== "standalone" && <p className="hidden min-w-0 flex-1 truncate text-left text-xs text-on-surface/70 sm:block">{settings.enterToSend ? "Enter để gửi · Shift + Enter để xuống dòng" : "Enter để xuống dòng · Nhấn gửi để thực hiện"}</p>}
        <button type="submit" aria-label={isLoading ? "Đang chờ trợ lý trả lời" : "Gửi tin nhắn"} disabled={isLoading || !synced || isListening || Boolean(retryRef.current) || !input.trim()} className={cn("ml-auto flex shrink-0 items-center justify-center bg-primary text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", mode === "standalone" && placement === "landing" ? "size-8 rounded-full" : "size-10 rounded-xl", focusClass)}>
          <SendHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>
    </form>
    {assistantMode === "work" && <p id="erp-chatbot-file-help" className="sr-only">Có thể tải tệp CSV, XLSX hoặc XLS, tối đa 100 dòng dữ liệu.</p>}
    {voiceError && <p id="erp-chatbot-voice-error" role="alert" className="text-pretty text-sm text-error">{voiceError}</p>}
    {speechError && <p role="status" className="text-pretty text-sm text-error">{speechError}</p>}
    <p id="erp-chatbot-voice-help" role={voiceStatus !== "off" || isListening ? "status" : undefined} className={mode === "standalone" ? "sr-only" : "text-left text-xs text-on-surface/70"}>{voiceStatus === "waiting" ? "Đang chờ “Hey Igen”. Hãy nói từ khóa rồi nêu yêu cầu." : voiceStatus === "command" ? "Mình đang nghe yêu cầu; sẽ tự gửi sau khi bạn ngừng nói." : voiceStatus === "manual" || isListening ? "Đang nghe tiếng Việt. Dừng để kiểm tra nội dung rồi gửi." : "Bạn có thể nhập hoặc nói yêu cầu; nội dung giọng nói sẽ được kiểm tra trước khi gửi."}</p>
  </div>;

  return <>
    {mode === "popup" && <button
      ref={launcherRef}
      type="button"
      popoverTarget="erp-chatbot-panel"
      aria-label={isOpen ? "Thu gọn trợ lý ảo AI" : "Mở trợ lý ảo AI"}
      aria-description="Kéo thả để di chuyển, hoặc dùng phím mũi tên khi nút đang được chọn."
      aria-expanded={isOpen}
      aria-controls="erp-chatbot-panel"
      title="Trợ lý ảo AI"
      style={launcherPosition
        ? { left: launcherPosition.x, top: launcherPosition.y }
        : { bottom: "calc(1rem + env(safe-area-inset-bottom))", right: "calc(1rem + env(safe-area-inset-right))" }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        launcherDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={moveLauncher}
      onPointerUp={finishLauncherDrag}
      onPointerCancel={(event) => {
        finishLauncherDrag(event);
        suppressLauncherClickRef.current = false;
      }}
      onKeyDown={(event) => {
        const step = 16;
        const offsets: Record<string, LauncherPosition> = {
          ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
          ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
        };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = clampLauncherPosition({ x: rect.left + offset.x, y: rect.top + offset.y }, event.currentTarget.offsetWidth);
        launcherPositionRef.current = position;
        setLauncherPosition(position);
        try { localStorage.setItem(launcherStorageKey, JSON.stringify(position)); } catch { /* Movement still works for this session. */ }
      }}
      onClick={(event) => {
        if (suppressLauncherClickRef.current) {
          event.preventDefault();
          suppressLauncherClickRef.current = false;
        }
      }}
      className={cn("assistant-launcher-button fixed z-40 flex size-14 touch-none select-none items-center justify-center rounded-full border-2 border-primary bg-transparent text-on-surface shadow-[0_0_8px_1px_rgba(0,173,252,0.25)] cursor-grab active:cursor-grabbing", focusClass)}
    >
      {isOpen ? <X className="size-6" aria-hidden="true" /> : <img src="/assistant-igen-head.webp" alt="" aria-hidden="true" className="pointer-events-none size-full object-contain" />}
    </button>}
    <section
      id="erp-chatbot-panel"
      popover={mode === "popup" ? "auto" : undefined}
      role={mode === "popup" ? "dialog" : "region"}
      aria-labelledby="erp-chatbot-title"
      onToggle={mode === "popup" ? (event) => {
        const open = event.newState === "open";
        setIsOpen(open);
        if (open) event.currentTarget.querySelector<HTMLTextAreaElement | HTMLSelectElement>(view === "chat" ? "#erp-chatbot-input" : "select")?.focus({ preventScroll: true });
        if (!open) { setShowConfirmClear(false); closeSpeech(); stopReplySpeech(); }
      } : undefined}
      data-fullscreen={mode === "popup" && fullscreen}
      data-standalone={mode === "standalone"}
      className="assistant-workspace m-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface p-0 text-on-surface shadow-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        {mode === "standalone" ? <h2 id="erp-chatbot-title" className="sr-only">Trợ lý ảo AI</h2> : <header className="flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><Bot className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-surface/70">iGen ERP</p>
              <h2 id="erp-chatbot-title" className="text-balance truncate text-sm font-semibold">Trợ lý ảo AI</h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isSpeaking && <><span role="status" className="sr-only">Đang đọc câu trả lời thành tiếng.</span><button type="button" aria-label="Dừng đọc câu trả lời" title="Dừng đọc câu trả lời" aria-pressed="true" onClick={stopReplySpeech} className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)}><VolumeX className="size-4" aria-hidden="true" /></button></>}
            {mode === "popup" && <button type="button" aria-label={fullscreen ? "Thu về cửa sổ lớn" : "Mở toàn màn hình"} aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)} className={cn("hidden size-10 items-center justify-center rounded-xl hover:bg-surface-container-high sm:flex", focusClass)}>{fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}</button>}
            <button type="button" aria-label="Bắt đầu cuộc trò chuyện mới" title="Bắt đầu cuộc trò chuyện mới" disabled={isLoading || Boolean(retryRef.current) || messages.length <= 1} onClick={() => setShowConfirmClear(true)} className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
            </button>
            {mode === "popup" ? <button type="button" popoverTarget="erp-chatbot-panel" popoverTargetAction="hide" aria-label="Thu gọn cửa sổ trò chuyện" className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)}>
              <X className="size-5" aria-hidden="true" />
            </button> : <button type="button" onClick={returnToPreviousPage} aria-label="Quay lại trang trước" title="Quay lại trang trước" className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)}>
              <X className="size-5" aria-hidden="true" />
            </button>}
          </div>
        </header>}
        <div className="flex min-h-0 flex-1">
        {mode === "standalone" ? <aside aria-label="Điều hướng trợ lý" style={{ "--assistant-rail-gradient": `url(#${railGradientId})` } as React.CSSProperties} className={cn("assistant-sidebar assistant-reference-sidebar shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest px-2 py-3", sidebarCollapsed && "is-collapsed")}>
          <svg className="absolute size-0" aria-hidden="true" focusable="false"><defs><linearGradient id={railGradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop offset="0%" stopColor="#00adfc" /><stop offset="55%" stopColor="#199bff" /><stop offset="100%" stopColor="#7567ff" /></linearGradient></defs></svg>
          <div className="assistant-sidebar-header mb-3 flex items-center justify-between gap-1.5">
            <button type="button" aria-label={sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!sidebarCollapsed} aria-controls="assistant-sidebar-navigation" onClick={() => setSidebarCollapsed(value => !value)} className={cn("assistant-sidebar-tool assistant-sidebar-collapse flex items-center justify-center rounded-lg hover:bg-surface-container-low", focusClass)}>{sidebarCollapsed ? <PanelLeftOpen className="size-5" aria-hidden="true" /> : <PanelLeftClose className="size-5" aria-hidden="true" />}</button>
            {!sidebarCollapsed && <button type="button" aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới" disabled={isLoading || Boolean(retryRef.current) || messages.length <= 1} onClick={() => setShowConfirmClear(true)} className={cn("assistant-sidebar-tool flex size-9 shrink-0 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:text-on-surface/35", focusClass)}><MessageSquarePlus className="size-5" aria-hidden="true" /></button>}
          </div>
          {!sidebarCollapsed && <div className="mb-2"><AssistantModeSwitcher assistantMode={assistantMode} disabled={isLoading || Boolean(retryRef.current)} onChange={onAssistantModeChange} placement="sidebar" /></div>}
          <nav id="assistant-sidebar-navigation" className="flex flex-col gap-1.5" aria-label="Điều hướng trợ lý">
            <button type="button" aria-label="Trò chuyện" aria-current={view === "chat" ? "page" : undefined} onClick={() => changeView("chat")} className={cn("assistant-side-item", view === "chat" && "is-active", focusClass)}><AssistantRailIcon name="chat" />{!sidebarCollapsed && <span>Trò chuyện</span>}</button>
            <button type="button" disabled title="Chưa có tính năng AI Studio" className="assistant-side-item" aria-label="AI Studio (chưa có)"><AssistantRailIcon name="studio" />{!sidebarCollapsed && <span>AI Studio</span>}</button>
            <button type="button" disabled title="Chưa có tính năng Notebook" className="assistant-side-item" aria-label="Notebook (chưa có)"><AssistantRailIcon name="notebook" />{!sidebarCollapsed && <span>Notebook</span>}</button>
            <button type="button" disabled title="Chưa có tính năng ghi chép cuộc họp" className="assistant-side-item" aria-label="Ghi chép cuộc họp (chưa có)"><AssistantRailIcon name="meeting" />{!sidebarCollapsed && <span>Ghi chép cuộc họp</span>}</button>
            <button type="button" aria-label="Trợ lý AI" onClick={openAssistantInput} className={cn("assistant-side-item", focusClass)}><AssistantRailIcon name="assistant" />{!sidebarCollapsed && <span>Trợ lý AI</span>}</button>
            <button type="button" disabled title="Chưa có tính năng dự án" className="assistant-side-item" aria-label="Dự án (chưa có)"><AssistantRailIcon name="project" />{!sidebarCollapsed && <span>Dự án</span>}</button>
            <button type="button" aria-label="Công cụ trợ lý" aria-haspopup="dialog" aria-controls="assistant-settings-dialog" onClick={() => { setWorkflowsVisited(true); setConfigView("workflows"); setIsSettingsDialogOpen(true); }} className={cn("assistant-side-item", focusClass)}><AssistantRailIcon name="tools" />{!sidebarCollapsed && <span>Công cụ</span>}</button>
            <button type="button" aria-label="Lịch sử trò chuyện" aria-current={view === "history" ? "page" : undefined} onClick={() => changeView("history")} className={cn("assistant-side-item", view === "history" && "is-active", focusClass)}><AssistantRailIcon name="history" />{!sidebarCollapsed && <span>Lịch sử</span>}</button>
          </nav>
          <div className="mt-auto border-t border-outline-variant pt-2"><button type="button" aria-label="Quản trị và thiết lập trợ lý" aria-haspopup="dialog" aria-controls="assistant-settings-dialog" aria-expanded={isSettingsDialogOpen} onClick={openSettings} className={cn("assistant-side-item", focusClass)}><AssistantRailIcon name="settings" />{!sidebarCollapsed && <span>Quản trị và thiết lập</span>}</button></div>
        </aside> : <aside aria-label="Điều hướng trợ lý" className="assistant-sidebar w-60 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low px-3 py-4">
          <p className="px-3 pb-2 text-xs font-medium text-on-surface/70">KHÔNG GIAN LÀM VIỆC</p>
          <nav className="flex flex-col gap-1" aria-label="Chế độ trợ lý">
            <button type="button" aria-pressed={view === "chat"} onClick={() => changeView("chat")} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", view === "chat" && "bg-surface-container-high font-semibold", focusClass)}><MessageSquare className="size-4 shrink-0" aria-hidden="true" />Trò chuyện</button>
            {view === "chat" && <AssistantModeSwitcher assistantMode={assistantMode} disabled={isLoading || Boolean(retryRef.current)} onChange={onAssistantModeChange} placement="sidebar" />}
            <button type="button" aria-pressed={view === "history"} onClick={() => changeView("history")} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", view === "history" && "bg-surface-container-high font-semibold", focusClass)}><History className="size-4 shrink-0" aria-hidden="true" />Lịch sử phiên</button>
          </nav>
          <div className="mt-auto border-t border-outline-variant pt-3">
            <button type="button" aria-haspopup="dialog" aria-expanded={isSettingsDialogOpen} aria-controls="assistant-settings-dialog" onClick={openSettings} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", isSettingsDialogOpen && "bg-surface-container-high font-semibold", focusClass)}><Settings2 className="size-4 shrink-0" aria-hidden="true" />Cài đặt trợ lý</button>
          </div>
        </aside>}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {mode === "standalone" && isSpeaking && <div className="assistant-reference-top-actions flex items-center gap-1">
          <button type="button" aria-label="Dừng đọc câu trả lời" title="Dừng đọc câu trả lời" onClick={stopReplySpeech} className={cn("flex size-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest", focusClass)}><VolumeX className="size-4" aria-hidden="true" /></button>
        </div>}
        <nav aria-label="Chế độ trợ lý" className="assistant-mobile-mode-nav flex shrink-0 gap-1 border-b border-outline-variant bg-surface-container-lowest p-2">
          <button type="button" aria-pressed={view === "chat"} onClick={() => changeView("chat")} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "chat" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><MessageSquare className="size-4 shrink-0" aria-hidden="true" />Trò chuyện</span></button>
          <button type="button" aria-pressed={view === "history"} onClick={() => changeView("history")} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "history" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><History className="size-4 shrink-0" aria-hidden="true" />Lịch sử</span></button>
          <button type="button" aria-haspopup="dialog" aria-expanded={isSettingsDialogOpen} aria-controls="assistant-settings-dialog" onClick={openSettings} className={cn("min-w-0 flex-1 rounded-xl px-1 py-2 text-sm", isSettingsDialogOpen && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><Settings2 className="size-4 shrink-0" aria-hidden="true" />Cài đặt</span></button>
        </nav>
        <div hidden={view !== "history"} className={cn("min-h-0 flex-1 flex-col", view === "history" && "flex")}>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-balance text-sm font-semibold">Các phiên trò chuyện</h3>
              <p className="text-pretty text-xs text-on-surface/70">Mở lại nội dung các phiên trước trong tài khoản này.</p>
            </div>
            <button type="button" aria-label="Tải lại lịch sử trò chuyện" title="Tải lại" onClick={() => setHistoryReload(value => value + 1)} disabled={historyLoading || historyLoadingMore} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface-container-high disabled:opacity-40", focusClass)}>
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div aria-busy={historyLoading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {historyLoading && <p role="status" className="p-3 text-sm text-on-surface/70">Đang tải lịch sử trò chuyện…</p>}
            {historyError && <div className="space-y-2 p-3"><p role="alert" className="text-pretty text-sm text-error">{historyError}</p><button type="button" onClick={() => setHistoryReload(value => value + 1)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focusClass)}>Thử tải lại</button></div>}
            {!historyLoading && !historyError && conversations.length === 0 && <div className="space-y-3 p-3">
              <p className="text-sm">Chưa có phiên trò chuyện nào để xem lại.</p>
              <button type="button" onClick={() => { setIsViewingHistory(false); setView("chat"); }} className={cn("rounded-xl bg-primary px-3 py-2 text-sm text-on-primary hover:bg-primary/90", focusClass)}>Bắt đầu trò chuyện</button>
            </div>}
            {(isLoading || retryRef.current) && <p role="status" className="p-3 text-pretty text-sm text-on-surface/70">Đợi yêu cầu hiện tại hoàn tất hoặc kiểm tra lại trước khi mở một phiên khác.</p>}
            {conversations.length > 0 && <ul className="space-y-2" aria-label="Danh sách phiên trò chuyện">
              {conversations.map(conversation => <li key={conversation.conversationId}>
                <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={() => openPreviousConversation(conversation)} className={cn("w-full rounded-xl border border-outline-variant bg-surface p-3 text-left hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 min-w-0 text-sm font-semibold">{conversation.title}</span>
                    <time className="shrink-0 text-xs tabular-nums text-on-surface/70" dateTime={conversation.updatedAt}>{formatConversationTime(conversation.updatedAt)}</time>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-pretty text-sm text-on-surface/80">{conversation.preview || "Chưa có nội dung tin nhắn."}</span>
                  <span className="mt-2 block text-xs tabular-nums text-on-surface/70">{conversation.messageCount} tin nhắn · {conversation.mode === "qa" ? "Hỏi đáp" : "Thao tác"}</span>
                </button>
              </li>)}
            </ul>}
            {historyCursor && !historyLoading && <div className="flex justify-center p-3">
              <button type="button" onClick={() => void loadOlderConversations()} disabled={historyLoadingMore} className={cn("rounded-xl border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low disabled:opacity-50", focusClass)}>{historyLoadingMore ? "Đang tải…" : "Tải thêm phiên cũ"}</button>
            </div>}
          </div>
        </div>
        <div hidden={view !== "chat"} className={cn("min-h-0 flex-1 flex-col", view === "chat" && "flex")}>
        <AssistantModeSwitcher assistantMode={assistantMode} disabled={isLoading || Boolean(retryRef.current)} onChange={onAssistantModeChange} placement="mobile" />
        {isViewingHistory && <div ref={historyBannerRef} tabIndex={-1} className={cn("shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-2", focusClass)}>
          <p className="text-pretty text-sm">Đang xem lại phiên cũ. Phiên này ở chế độ chỉ đọc.</p>
        </div>}
        {isWelcomeScreen ? <div ref={logRef} className={cn("assistant-welcome min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-8", mode === "standalone" && "assistant-reference-welcome")}>
          <section aria-labelledby="assistant-welcome-title" className={cn("mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-7 sm:gap-8", mode === "standalone" && "assistant-reference-content")}>
            <div className="space-y-3 text-center">
              {mode !== "standalone" && <><span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-low text-primary">
                <Bot className="size-6" aria-hidden="true" />
              </span></>}
              <p className="text-xs font-semibold text-primary">{assistantMode === "qa" ? "HỎI ĐÁP · IGEN ERP" : "THAO TÁC · IGEN ERP"}</p>
              <h1 id="assistant-welcome-title" className="text-balance text-2xl font-semibold sm:text-3xl">{assistantMode === "qa" ? "Bạn muốn hỏi điều gì?" : mode === "standalone" ? <>Xin chào {userProfile?.displayName || "bạn"}, mình là Trợ lí AI của <span className="assistant-brand-name">iGen</span> <span aria-hidden="true">👋</span></> : "Xin chào, tôi có thể giúp gì cho bạn?"}</h1>
              <p className="mx-auto max-w-2xl text-pretty text-sm leading-6 text-on-surface/70 sm:text-base">{assistantMode === "qa" ? "Hỏi đáp, nhờ giải thích, viết hoặc tóm tắt như khi trò chuyện với ChatGPT. Tab này không truy cập hay thay đổi dữ liệu ERP." : "Mô tả công việc bằng ngôn ngữ tự nhiên. Tôi sẽ hỏi thêm khi thiếu thông tin và xin bạn xác nhận trước khi cập nhật dữ liệu."}</p>
            </div>
            {isLoading && <p role="status" className="text-center text-sm text-on-surface/70">Đang tải cuộc trò chuyện…</p>}
            {renderComposer("landing")}
            {mode === "standalone" && assistantMode === "work" && <div className="assistant-quick-actions" aria-label="Tác vụ trợ lý">
              <button type="button" data-tone="cyan" disabled={!synced || isLoading || isReadingAttachment} onClick={() => attachmentInputRef.current?.click()} className={cn("assistant-action-chip", focusClass)}><AssistantGradientIcon Icon={Paperclip} className="size-4" />Đính kèm bảng</button>
              <button type="button" data-tone="violet" disabled={!synced || isLoading} onClick={toggleVoiceInput} className={cn("assistant-action-chip", focusClass)}><AssistantGradientIcon Icon={Mic} className="size-4" />Nhập giọng nói</button>
              {([ ["Tạo hình ảnh", Image], ["Tạo video", Video], ["Tạo infographic", FileImage], ["Tạo slide", Presentation], ["Tạo nhạc", Music2], ["Tạo audio", Volume2], ["Tạo giọng cá nhân", Mic], ["Tạo biểu đồ", ChartNoAxesCombined], ["Notebook", NotebookPen], ["Ghi chép cuộc họp", FileText], ["Tạo mindmap", WandSparkles], ["Tóm tắt YouTube", Video] ] as const).map(([label, Icon]) => <button key={label} type="button" disabled title={`${label} chưa có trong trợ lý`} className="assistant-action-chip"><Icon className="size-4" aria-hidden="true" />{label}</button>)}
            </div>}
            {settings.showSuggestions && synced && <section aria-label={assistantMode === "qa" ? "Gợi ý câu hỏi" : "Gợi ý yêu cầu"} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-balance text-sm font-semibold">{assistantMode === "qa" ? "Thử hỏi một câu" : "Bắt đầu với một yêu cầu"}</h2>
                <p className="text-pretty text-xs text-on-surface/70">{assistantMode === "qa" ? "Chọn gợi ý để bắt đầu hỏi đáp" : "Chọn gợi ý để điền nhanh vào khung chat"}</p>
              </div>
              <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3", mode === "standalone" && "assistant-reference-suggestions")}>
                {(assistantMode === "qa" ? qaSuggestions : suggestions).map(({ prompt, category, Icon }) => <button key={prompt} data-tone={category === "Nhân sự" ? "cyan" : category === "Khách hàng" ? "brand" : "violet"} type="button" onClick={() => void handleSend(prompt)} className={cn("group flex min-h-20 w-full items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 text-left hover:border-primary hover:bg-surface-container-low sm:p-4", mode === "standalone" && "assistant-promo-card", focusClass)}>
                  {mode === "standalone" ? <>
                    <span className="assistant-promo-copy">
                      <span className="assistant-promo-title">{prompt}</span>
                      <span className="assistant-promo-cta">Thử ngay <ArrowUpRight className="size-3.5" aria-hidden="true" /></span>
                    </span>
                    <span className="assistant-promo-art" aria-hidden="true"><span className="assistant-promo-orbit" /><AssistantGradientIcon Icon={Icon} className="size-8" /><span className="assistant-promo-sparkle">✦</span></span>
                  </> : <>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary"><Icon className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-on-surface/70">{category}</span><span className="mt-1 block text-pretty text-sm font-semibold">{prompt}</span></span>
                    <ArrowUpRight className="size-4 shrink-0 text-on-surface/60 group-hover:text-primary" aria-hidden="true" />
                  </>}
                </button>)}
              </div>
            </section>}
          </section>
        </div> : <>
        <div ref={logRef} role="log" aria-label="Nội dung trò chuyện" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {messages.filter((message, index) => !(index === 0 && message.role === "assistant" && message.content === activeWelcomeMessage.content)).map((message, index) => <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            {message.role === "user" ? <div className="max-w-3xl rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-on-primary">
              <span className="sr-only">Bạn: </span>
              <p className="whitespace-pre-wrap break-words text-pretty" style={{ overflowWrap: "anywhere" }}>
                {message.content.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}
              </p>
            </div> : <div className="flex w-full max-w-4xl items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-primary" aria-hidden="true"><Bot className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p aria-hidden="true" className="mb-1.5 text-xs font-semibold text-on-surface/70">Trợ lý AI</p>
                <div className="rounded-2xl rounded-tl-sm border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface shadow-sm">
                  <span className="sr-only">Trợ lý: </span>
                  <AssistantMessageContent content={message.content} />
                </div>
              </div>
            </div>}
          </div>)}
          {lastReply?.referenceSelections?.length ? <section aria-labelledby="assistant-reference-selection-title" className="ml-12 max-w-4xl space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-sm shadow-sm sm:p-5">
            <header>
              <h3 id="assistant-reference-selection-title" className="text-balance font-semibold">Chọn thông tin liên quan</h3>
              <p className="mt-1 text-pretty text-xs text-on-surface/70">Chọn ngay tại đây để tiếp tục. Mục tùy chọn có thể bỏ qua.</p>
            </header>
            <div className="space-y-4">
              {lastReply.referenceSelections.map((group, groupIndex) => {
                const useCheckboxes = group.multiple || !group.required;
                return <fieldset key={group.key} className="space-y-2">
                  <legend className="mb-2 font-medium">{group.label}<span className="ml-2 text-xs font-normal text-on-surface/70">{group.required ? "Bắt buộc" : "Tùy chọn"}{group.multiple ? " · Có thể chọn nhiều" : ""}</span></legend>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.options.map((option, optionIndex) => {
                      const id = `assistant-reference-${groupIndex}-${optionIndex}`;
                      const checked = Boolean(selectedReferences[group.key]?.includes(option.value));
                      return <li key={option.value}>
                        <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-outline-variant bg-surface px-3 py-2.5 hover:bg-surface-container-low", focusClass, (isLoading || isViewingHistory || Boolean(retryRef.current)) && "cursor-not-allowed opacity-50")}>
                          <input id={id} type={useCheckboxes ? "checkbox" : "radio"} name={`assistant-reference-${groupIndex}`} value={option.value} checked={checked} disabled={isLoading || isViewingHistory || Boolean(retryRef.current)} onChange={event => toggleReferenceSelection(group.key, option.value, event.currentTarget.checked, group.multiple)} className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" />
                          <span className="min-w-0 break-words text-pretty">{option.label}</span>
                        </label>
                      </li>;
                    })}
                  </ul>
                </fieldset>;
              })}
            </div>
            {referenceSelectionError && <p role="alert" className="text-pretty text-sm text-error">{referenceSelectionError}</p>}
            {hasMissingRequiredReferenceSelection && <p id="assistant-reference-selection-help" role="status" className="text-pretty text-xs text-on-surface/70">Chọn một mục cho mỗi thông tin bắt buộc để tiếp tục.</p>}
            <button type="button" aria-describedby={hasMissingRequiredReferenceSelection ? "assistant-reference-selection-help" : undefined} disabled={isLoading || !synced || Boolean(retryRef.current) || hasMissingRequiredReferenceSelection} onClick={() => void submitReferenceSelections()} className={cn("min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
              Dùng lựa chọn
            </button>
          </section> : null}
          {lastReply?.trainingContentForm && <AssistantTrainingContentForm
            key={lastReply.action?.id || "assistant-training-content"}
            value={lastReply.trainingContentForm}
            readOnly={isViewingHistory}
            submitting={isLoading || Boolean(retryRef.current)}
            canSubmit={synced && !isLoading && !retryRef.current}
            onSubmit={trainingContent => void submitTrainingContent(trainingContent)}
          />}
          {lastReply?.action && <section aria-label="Bản xem trước thao tác" className="ml-12 max-w-4xl overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest text-sm shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{lastReply.status === "confirmation" ? "XEM LẠI TRƯỚC KHI XÁC NHẬN" : "THÔNG TIN THAO TÁC"}</p>
                <h3 className="mt-1 text-balance font-semibold">{lastReply.action.title}</h3>
              </div>
              {lastReply.status === "confirmation" && <span className="inline-flex shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium">Chờ xác nhận</span>}
            </header>
            {lastReply.action.values.length > 0 && <dl className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4">
              {lastReply.action.values.map(item => <div key={item.label} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                <dt className="text-xs text-on-surface/70">{item.label}</dt>
                <dd className="mt-1 break-words font-medium tabular-nums">{String(item.value)}{item.defaulted ? " (mặc định)" : ""}</dd>
              </div>)}
            </dl>}
            {lastReply.status === "confirmation" && <div className="space-y-3 border-t border-outline-variant px-4 py-3 sm:px-5">
              <p className="text-pretty text-xs text-on-surface/70">Thao tác chưa được thực hiện. Kiểm tra lại thông tin rồi xác nhận để tiếp tục.</p>
              {lastReply.action.requiresPassword && <div className="space-y-1.5 text-sm"><label htmlFor="assistant-account-password" className="font-medium">Mật khẩu khởi tạo</label><input id="assistant-account-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="assistant-password-help" className={cn("w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-base text-on-surface sm:max-w-sm", focusClass)} /><span id="assistant-password-help" className="block text-xs text-on-surface/70">Tối thiểu 6 ký tự. Mật khẩu không lưu trong hội thoại và không gửi cho AI.</span></div>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" disabled={isLoading || Boolean(retryRef.current) || (lastReply.action.requiresPassword && password.length < 6)} onClick={() => decide(true)} className={cn("min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Xác nhận thực hiện</button>
                <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={() => decide(false)} className={cn("min-h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Hủy thao tác</button>
              </div>
            </div>}
          </section>}
          {lastReply?.link && <a href={lastReply.link} className={cn("inline-block rounded px-2 py-1 text-sm text-primary underline", focusClass)}>Mở phân hệ để xem kết quả</a>}
          {isLoading && <p role="status" className="text-sm text-on-surface/70">Trợ lý đang xử lý yêu cầu…</p>}
          </div>
        </div>
        <footer className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-3 py-3 sm:px-6">
          {isViewingHistory ? <div className="space-y-2">
            {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
            <p className="text-pretty text-xs text-on-surface/70">Bạn có thể xem lại nội dung trước, hoặc tiếp tục làm việc trong chính phiên này.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={continuePreviousConversation} className={cn("min-h-11 rounded-xl bg-primary px-3 py-2 text-sm text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>Tiếp tục phiên này</button>
              <button type="button" onClick={() => setShowConfirmClear(true)} className={cn("min-h-11 rounded-xl border border-outline-variant px-3 py-2 text-sm hover:bg-surface-container-low", focusClass)}>Bắt đầu cuộc trò chuyện mới</button>
            </div>
          </div> : renderComposer("conversation")}
        </footer>
        </>}
        </div>
        </div>
        </div>
        <dialog
          ref={settingsDialogRef}
          id="assistant-settings-dialog"
          aria-labelledby="assistant-settings-title"
          onCancel={(event) => { event.preventDefault(); closeSpeech(); stopReplySpeech(); setIsSettingsDialogOpen(false); }}
          onClose={() => setIsSettingsDialogOpen(false)}
          onClick={(event) => { if (event.target === event.currentTarget) setIsSettingsDialogOpen(false); }}
          className="m-auto h-[calc(100dvh-2rem)] max-h-[52rem] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-2xl border border-outline-variant bg-surface p-0 text-on-surface shadow-2xl backdrop:bg-on-surface/50"
        >
          <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
              <div className="min-w-0"><p className="text-xs font-medium text-on-surface/70">TRỢ LÝ AI · IGEN ERP</p><h2 id="assistant-settings-title" className="text-balance text-base font-semibold">Cài đặt trợ lý</h2></div>
              <button type="button" aria-label="Đóng cài đặt trợ lý" onClick={() => setIsSettingsDialogOpen(false)} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)} data-erp-modal-close><X className="size-5" aria-hidden="true" /></button>
            </header>
            <nav aria-label="Cấu hình trợ lý" className="grid shrink-0 grid-cols-3 gap-2 border-b border-outline-variant bg-surface-container-lowest px-3 py-2">
              <button type="button" aria-pressed={configView === "workflows"} onClick={() => setConfigView("workflows")} className={cn("min-h-10 rounded-xl px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm", configView === "workflows" ? "bg-primary text-on-primary" : "hover:bg-surface-container-low", focusClass)}>Workflow nghiệp vụ</button>
              <button type="button" aria-pressed={configView === "settings"} onClick={() => setConfigView("settings")} className={cn("min-h-10 rounded-xl px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm", configView === "settings" ? "bg-primary text-on-primary" : "hover:bg-surface-container-low", focusClass)}>Cài đặt trợ lý</button>
              <button type="button" aria-pressed={configView === "memory"} onClick={() => setConfigView("memory")} className={cn("min-h-10 rounded-xl px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm", configView === "memory" ? "bg-primary text-on-primary" : "hover:bg-surface-container-low", focusClass)}>Ghi nhớ</button>
            </nav>
            <div className="min-h-0 flex-1 overflow-hidden">
              <div hidden={configView !== "workflows"} className={cn("min-h-0 h-full flex-col", configView === "workflows" && "flex")}>{workflowsVisited && <AssistantWorkflowEditor />}</div>
              <div hidden={configView !== "settings"} className={cn("min-h-0 h-full flex-col", configView === "settings" && "flex")}>
                {settingsError ? <div className="space-y-2 p-4"><p role="alert" className="text-sm text-error">{settingsError}</p><button type="button" onClick={() => setSettingsRetry(value => value + 1)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focusClass)}>Thử tải cài đặt lại</button></div> : !settingsReady ? <p role="status" className="p-4 text-sm">Đang tải cài đặt…</p> : <AssistantSettingsEditor settings={settings} onSave={applySettings} />}
              </div>
              <div hidden={configView !== "memory"} className={cn("min-h-0 h-full flex-col", configView === "memory" && "flex")}>
                {settingsError ? <div className="space-y-2 p-4"><p role="alert" className="text-sm text-error">{settingsError}</p><button type="button" onClick={() => setSettingsRetry(value => value + 1)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focusClass)}>Thử tải cài đặt lại</button></div> : !settingsReady ? <p role="status" className="p-4 text-sm">Đang tải cài đặt…</p> : configView === "memory" && <AssistantMemoryManager enabled={settings.memoryEnabled} />}
              </div>
            </div>
          </div>
        </dialog>
        <ConfirmDialog isOpen={showConfirmClear} title="Bắt đầu cuộc trò chuyện mới?" description="Bạn sẽ bắt đầu yêu cầu mới. Thao tác đã thực hiện vẫn giữ nguyên; thông tin đang thu thập sẽ không được chuyển sang cuộc trò chuyện mới." confirmLabel="Bắt đầu mới" onClose={closeConfirmation} onConfirm={startNew} />
      </div>
    </section>
  </>;
}
