import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, AudioLines, Building2, ChartNoAxesCombined, ClipboardList, FileImage, FileText, History, Image, Maximize2, MessageSquare, MessageSquarePlus, Mic, MicOff, Minimize2, Music2, NotebookPen, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, Presentation, RefreshCw, SendHorizontal, Settings2, Trash2, UserRound, UserRoundPlus, Video, Volume2, VolumeX, WandSparkles, X, Youtube } from "lucide-react";
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
import { AssistantMessageContent } from "./AssistantMessageContent";
import { AssistantSidebarIcon, type AssistantSidebarIconName } from "./AssistantSidebarIcon";
import { cn } from "../../modules/student-management/lib/utils";
import { readAssistantTableFile } from "./assistant-table-file";
import { AssistantTrainingContentForm } from "./AssistantTrainingContentForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { StyledSelect } from "./StyledSelect";
import { AiAssistantIcon } from "./HeaderShortcutIcons";
import { messageDateLabel, messageLocalDateKey, messageTimeLabel } from "./chatMessageTime";

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
type VoiceStatus = "off" | "manual" | "auto" | "waiting" | "command";

interface Message {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}
type AssistantMode = "work" | "qa";
const assistantHeaderOptions = [{ value: "qa", label: "Hỏi đáp" }, { value: "work", label: "Thao tác" }];

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
function voiceContextError(): string {
  const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
  return window.isSecureContext === false && !loopback
    ? "Trình duyệt chỉ cho dùng micro trên HTTPS hoặc localhost. Hãy mở ứng dụng bằng địa chỉ HTTPS rồi thử lại."
    : "";
}
type LauncherPosition = { x: number; y: number };
const previewActions = [
  { label: "Tạo hình ảnh", Icon: Image, from: "#3865d8", middle: "#398ce9", to: "#735be8" },
  { label: "Tạo video", Icon: Video, from: "#df6043", middle: "#f28b4c", to: "#e6a454" },
  { label: "Tạo infographic", Icon: FileImage, from: "#3773d6", middle: "#5192eb", to: "#6862d9" },
  { label: "Tạo slide", Icon: Presentation, from: "#d69b2f", middle: "#f0bd47", to: "#e48935" },
  { label: "Tạo nhạc", Icon: Music2, from: "#d34bc2", middle: "#ec62d4", to: "#8d53e4" },
  { label: "Tạo audio", Icon: Volume2, from: "#4864d5", middle: "#499ce4", to: "#744ce1" },
  { label: "Tạo giọng cá nhân", Icon: AudioLines, from: "#d04a9e", middle: "#d95dc9", to: "#984be2" },
  { label: "Tạo biểu đồ", Icon: ChartNoAxesCombined, from: "#6349cd", middle: "#8d5be6", to: "#ba6ce5" },
  { label: "Notebook", Icon: NotebookPen, from: "#398cd6", middle: "#5ba3e4", to: "#7757d8" },
  { label: "Ghi chép cuộc họp", Icon: FileText, from: "#d8784c", middle: "#e8a264", to: "#c8659c" },
  { label: "Tạo mindmap", Icon: WandSparkles, from: "#d4743c", middle: "#e79545", to: "#cb563e" },
  { label: "Tóm tắt YouTube", Icon: Youtube, from: "#ca494f", middle: "#ea654c", to: "#d78446" },
] as const;
function AssistantTypingPlaceholder({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  return <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 text-base text-on-surface/60 sm:text-lg">
    {reduceMotion ? text : Array.from(text).map((character, index) => <motion.span key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0, delay: index * 0.055 }}>{character === " " ? "\u00a0" : character}</motion.span>)}
  </span>;
}

function RevealingAssistantMessage({ content, requestId, onComplete, onProgress }: { content: string; requestId: string; onComplete: (requestId: string) => void; onProgress: () => void }) {
  const reduceMotion = useReducedMotion();
  const [visibleCharacters, setVisibleCharacters] = useState(0);

  useEffect(() => {
    const length = Array.from(content).length;
    if (reduceMotion || length === 0) {
      onComplete(requestId);
      return;
    }
    const playback = animate(0, length, {
      duration: Math.min(18, Math.max(0.8, length / 32)),
      ease: "linear",
      onUpdate: value => {
        const next = Math.min(length, Math.floor(value));
        setVisibleCharacters(previous => previous === next ? previous : next);
        onProgress();
      },
      onComplete: () => {
        setVisibleCharacters(length);
        onComplete(requestId);
      },
    });
    return () => playback.stop();
  }, [content, onComplete, onProgress, reduceMotion, requestId]);

  return <>
    <span className="sr-only">{content}</span>
    <div aria-hidden="true" className="assistant-message-reveal"><AssistantMessageContent content={content} visibleCharacters={visibleCharacters} /></div>
  </>;
}
function AssistantGradientIcon({ Icon, from = "#00adfc", middle = "#199bff", to = "#7567ff", className = "size-6" }: { Icon: LucideIcon; from?: string; middle?: string; to?: string; className?: string }) {
  const gradientId = useId().replace(/:/g, "");
  return <Icon className={cn(className, "shrink-0")} strokeWidth={2} stroke={`url(#${gradientId})`} aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor={from} /><stop offset="55%" stopColor={middle} /><stop offset="100%" stopColor={to} /></linearGradient></defs>
  </Icon>;
}

function AssistantVoiceChatIcon() {
  const gradientId = useId().replace(/:/g, "");
  return <svg viewBox="0 0 24 24" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#ee638a" /><stop offset="55%" stopColor="#c452df" /><stop offset="100%" stopColor="#7559ed" /></linearGradient></defs>
    <path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.3A8 8 0 1 1 20 11.5Z" />
    <path d="M9 10.5v2M12 8.5v6M15 10.5v2" />
  </svg>;
}

function AssistantRailIcon({ name }: { name: AssistantSidebarIconName }) {
  return <span className="assistant-side-icon" aria-hidden="true"><AssistantSidebarIcon name={name} /></span>;
}

function AssistantHeaderAvatar() {
  return <img src="/assistant-igen-head.webp" alt="" aria-hidden="true" draggable={false} className="block size-8 shrink-0 object-contain" />;
}

function AssistantVerifiedBadge() {
  return <svg viewBox="0 0 20 20" className="size-4.5 shrink-0" aria-hidden="true" focusable="false">
    <path d="M10 1.1 12.1 2.3 14.5 2.1 15.8 4.2 18 5.4 17.8 7.8 19 10 17.8 12.2 18 14.6 15.8 15.8 14.5 17.9 12.1 17.7 10 18.9 7.9 17.7 5.5 17.9 4.2 15.8 2 14.6 2.2 12.2 1 10 2.2 7.8 2 5.4 4.2 4.2 5.5 2.1 7.9 2.3Z" fill="var(--color-primary)" />
    <path d="m6 10 2.6 2.6L14 7.3" fill="none" stroke="var(--color-on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function AssistantLiveVoiceIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true" focusable="false">
    <path d="M10.7 4.1a6.2 6.2 0 0 0-5 8.8l-1.5 2.2a1 1 0 0 0 .8 1.5h2.1l.6 3.2h5.1v-3.1" />
    <path d="M14.4 8.5a4.2 4.2 0 0 1 0 7" />
    <path d="M17.1 6.1a7.4 7.4 0 0 1 0 11.8" />
    <path d="M19.6 3.8a10.7 10.7 0 0 1 0 16.4" />
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
  try { return localStorage.getItem(`igen_erp_chatbot_mode:${scope}`) === "work" ? "work" : "qa"; }
  catch { return "qa"; }
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function ChatbotWidget({ storageScope, mode = "popup", headerPanel = false, openRequest = 0 }: { storageScope: string; mode?: "popup" | "standalone"; headerPanel?: boolean; openRequest?: number }) {
  const { userProfile } = useAuth();
  const branch = useBranchOptional();
  const scope = `${storageScope}:${branch?.activeBranchId || "company"}`;
  const branchId = branch?.activeBranchId || "";
  const deviceId = userProfile?.companyCode && branchId ? getPosTerminalId(userProfile.companyCode, branchId) : undefined;
  return <ChatbotModeShell key={`${scope}:${mode}`} storageScope={scope} launcherStorageScope={storageScope} branchId={branchId} deviceId={deviceId} mode={mode} headerPanel={headerPanel} openRequest={openRequest} />;
}

function ChatbotModeShell({ storageScope, launcherStorageScope, branchId, deviceId, mode, headerPanel, openRequest }: { storageScope: string; launcherStorageScope: string; branchId: string; deviceId?: string; mode: "popup" | "standalone"; headerPanel: boolean; openRequest: number }) {
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
    headerPanel={headerPanel}
    openRequest={openRequest}
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

function ChatbotSession({ storageScope, launcherStorageScope, branchId, deviceId, mode, headerPanel, openRequest, assistantMode, initialConversationId, onAssistantModeChange }: { storageScope: string; launcherStorageScope: string; branchId: string; deviceId?: string; mode: "popup" | "standalone"; headerPanel: boolean; openRequest: number; assistantMode: AssistantMode; initialConversationId: string | null; onAssistantModeChange: (mode: AssistantMode, conversationId?: string) => void }) {
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
  const promptPlaceholder = assistantMode === "work" ? "Bạn muốn thực hiện việc gì?" : "Hãy hỏi tôi điều gì đó?";
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
  const [pendingConversationDelete, setPendingConversationDelete] = useState<AssistantConversationSummary | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<AssistantReply | null>(null);
  const [selectedReferences, setSelectedReferences] = useState<Record<string, string[]>>({});
  const [referenceSelectionError, setReferenceSelectionError] = useState("");
  const [workflowsVisited, setWorkflowsVisited] = useState(false);
  const [synced, setSynced] = useState(false);
  const retryRef = useRef<AssistantTurnInput | null>(null);
  const [isOpen, setIsOpen] = useState(mode === "standalone");
  useEffect(() => {
    if (!headerPanel || mode !== "popup" || openRequest < 1) return;
    const panel = document.getElementById("erp-chatbot-panel");
    if (panel && !panel.matches(":popover-open")) panel.showPopover();
  }, [headerPanel, mode, openRequest]);
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
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechBaseRef = useRef("");
  const voiceTranscriptRef = useRef("");
  const voiceStatusRef = useRef<VoiceStatus>("off");
  const commandTextRef = useRef("");
  const commandResultIndexRef = useRef<number | null>(null);
  const voiceSilenceTimerRef = useRef<number | null>(null);
  const recognizedVoiceHandlerRef = useRef<(text: string) => void>(() => undefined);
  const [wakeRestartVersion, setWakeRestartVersion] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioUrlRef = useRef<string | null>(null);
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
    setPendingVoiceCommand("");
    setWakeRestartVersion(value => value + 1);
  }, []);
  const stopReplySpeech = useCallback(() => {
    speechRunIdRef.current += 1;
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (speechAudioRef.current) {
      speechAudioRef.current.onended = null;
      speechAudioRef.current.onerror = null;
      speechAudioRef.current.pause();
      speechAudioRef.current = null;
    }
    if (speechAudioUrlRef.current) URL.revokeObjectURL(speechAudioUrlRef.current);
    speechAudioUrlRef.current = null;
    setIsSpeaking(false);
  }, []);
  const speakReply = useCallback(async (text: string) => {
    if (!settings.speakReplies) return;
    stopReplySpeech();
    const runId = speechRunIdRef.current;
    const controller = new AbortController();
    speechRequestRef.current = controller;
    setSpeechError("");
    setIsSpeaking(true);
    const finish = () => {
      if (runId !== speechRunIdRef.current) return;
      speechRequestRef.current = null;
      speechAudioRef.current = null;
      if (speechAudioUrlRef.current) URL.revokeObjectURL(speechAudioUrlRef.current);
      speechAudioUrlRef.current = null;
      setIsSpeaking(false);
    };
    try {
      const audioBlob = await assistantService.speech(text, controller.signal, settings.speechVoice);
      if (controller.signal.aborted || runId !== speechRunIdRef.current) return;
      const url = URL.createObjectURL(audioBlob);
      speechAudioUrlRef.current = url;
      const audio = new Audio(url);
      speechAudioRef.current = audio;
      audio.onended = finish;
      audio.onerror = () => {
        if (runId !== speechRunIdRef.current) return;
        finish();
        setSpeechError("Không thể phát tệp âm thanh trên thiết bị này.");
      };
      await audio.play();
    } catch (cause) {
      if (!controller.signal.aborted && runId === speechRunIdRef.current) {
        finish();
        const error = cause as Error;
        setSpeechError(error.name === "NotAllowedError"
          ? "Trình duyệt đang chặn phát âm thanh tự động. Hãy cho phép trang này phát âm thanh rồi thử lại."
          : error.name === "NotSupportedError"
            ? "Thiết bị này không hỗ trợ phát tệp âm thanh MP3."
            : error.message || "Không thể đọc câu trả lời thành tiếng.");
      }
    }
  }, [settings.speakReplies, settings.speechVoice, stopReplySpeech]);
  const applySettings = (value: AssistantSettings) => {
    setSettings(value);
    setFullscreen(value.windowMode === "fullscreen");
    if (!value.speakReplies) { stopReplySpeech(); setSpeechError(""); }
  };
  const [messages, setMessages] = useState<Message[]>(() => readHistory(storageKey, activeWelcomeMessage));
  const [revealingReply, setRevealingReply] = useState<{ requestId: string; content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const historyBannerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resumeFocusRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const previousAssistantModeRef = useRef(assistantMode);

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
    if (speechAudioRef.current) {
      speechAudioRef.current.onended = null;
      speechAudioRef.current.onerror = null;
      speechAudioRef.current.pause();
      speechAudioRef.current = null;
    }
    if (speechAudioUrlRef.current) URL.revokeObjectURL(speechAudioUrlRef.current);
    speechAudioUrlRef.current = null;
  }, []);
  useEffect(() => {
    const onlyWelcome = messages.length === 1 && messages[0].role === "assistant" && messages[0].content === welcomeMessage.content;
    if (isOpen && !onlyWelcome && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isLoading, isOpen]);
  const followReplyReveal = useCallback(() => {
    requestAnimationFrame(() => {
      const log = logRef.current;
      if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 120) log.scrollTop = log.scrollHeight;
    });
  }, []);
  const finishReplyReveal = useCallback((requestId: string) => {
    setRevealingReply(current => current?.requestId === requestId ? null : current);
  }, []);

  const saveHistory = (next: Message[], persist = !isViewingHistory) => {
    setRevealingReply(null);
    setMessages(next);
    if (!persist) return;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep in memory. */ }
  };

  useEffect(() => {
    if (previousAssistantModeRef.current === assistantMode) return;
    previousAssistantModeRef.current = assistantMode;
    closeSpeech();
    stopReplySpeech();
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
      if (messages[messages.length - 1]?.role !== "assistant" || messages[messages.length - 1]?.content !== result.reply) {
        setRevealingReply({ requestId: request.requestId, content: result.reply });
      }
      setMessages(current => {
        const last = current[current.length - 1];
        const next: Message[] = last?.role === "assistant" && last.content === result.reply ? current : [...current, { role: "assistant", content: result.reply, createdAt: new Date().toISOString() }];
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

  const deleteConversation = async () => {
    if (!pendingConversationDelete || deletingConversationId) return;
    const conversation = pendingConversationDelete;
    setDeletingConversationId(conversation.conversationId);
    setHistoryError("");
    try {
      await assistantService.deleteConversation(conversation.conversationId, branchId);
      setConversations(current => current.filter(item => item.conversationId !== conversation.conversationId));
      setPendingConversationDelete(null);
      if (conversation.conversationId === conversationId) {
        const nextId = crypto.randomUUID();
        try { localStorage.setItem(conversationKey, nextId); localStorage.removeItem(requestKey); } catch { /* Keep the next session in memory. */ }
        setConversationId(nextId);
        setIsViewingHistory(false);
        setSynced(false);
        setLastReply(null);
        saveHistory([activeWelcomeMessage], true);
      }
    } catch (cause) {
      setHistoryError((cause as Error).message);
      setPendingConversationDelete(null);
    } finally {
      setDeletingConversationId(null);
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
    saveHistory([...messages, { role: "user", content: `${text}${pendingAttachment ? `\n📎 ${pendingAttachment.fileName} · ${pendingAttachment.rows.length} dòng` : ""}`, createdAt: new Date().toISOString() }]);
    setInput(""); setLastReply(null); setRevealingReply(null); setSelectedReferences({}); setReferenceSelectionError(""); setVoiceError("");
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, text, ...(pendingAttachment ? { attachment: pendingAttachment } : {}) });
  };
  const submitRecognizedVoice = async (recognizedText: string) => {
    const text = recognizedText.trim();
    if (isViewingHistory || !text || isLoading || !synced || isReadingAttachment || retryRef.current) return;
    stopReplySpeech();
    const pendingAttachment = assistantMode === "work" && attachment && !attachmentSubmitted ? attachment : undefined;
    saveHistory([...messages, { role: "user", content: `${text}${pendingAttachment ? `\n📎 ${pendingAttachment.fileName} · ${pendingAttachment.rows.length} dòng` : ""}`, createdAt: new Date().toISOString() }]);
    setInput(""); setLastReply(null); setSelectedReferences({}); setReferenceSelectionError(""); setVoiceError("");
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, text, ...(pendingAttachment ? { attachment: pendingAttachment } : {}) });
  };
  recognizedVoiceHandlerRef.current = text => { void submitRecognizedVoice(text); };
  useEffect(() => {
    if (!pendingVoiceCommand || !isOpen || !synced || isLoading || isViewingHistory || retryRef.current) return;
    setPendingVoiceCommand("");
    recognizedVoiceHandlerRef.current(pendingVoiceCommand);
  }, [pendingVoiceCommand, isOpen, synced, isLoading, isViewingHistory]);
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
  const toggleVoiceInput = (mode: "manual" | "auto") => {
    const contextError = voiceContextError();
    if (contextError) { setVoiceError(contextError); return; }
    if (recognitionRef.current && voiceStatusRef.current === "waiting") {
      const waitingRecognition = recognitionRef.current;
      recognitionRef.current = null;
      waitingRecognition.abort();
    }
    else if (recognitionRef.current) {
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
    voiceStatusRef.current = mode;
    setVoiceStatus(mode);
    speechBaseRef.current = mode === "manual" ? input.trimEnd() : "";
    voiceTranscriptRef.current = "";
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
      voiceTranscriptRef.current = transcript;
      setInput([speechBaseRef.current, transcript].filter(Boolean).join(speechBaseRef.current ? " " : ""));
      if (mode === "auto") {
        if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = finalParts.length && !interimParts.length
          ? window.setTimeout(() => recognition.stop(), 1400)
          : null;
      }
    };
    recognition.onerror = event => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "aborted") return;
      setIsListening(false);
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      recognitionRef.current = null;
      if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
      setWakeRestartVersion(value => value + 1);
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
      const spokenText = voiceTranscriptRef.current.trim();
      recognitionRef.current = null;
      if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
      setIsListening(false);
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      if (mode === "auto" && spokenText) recognizedVoiceHandlerRef.current(spokenText);
      else setInput(current => current.trim() ? current : speechBaseRef.current);
      setWakeRestartVersion(value => value + 1);
    };
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setIsListening(false);
      voiceStatusRef.current = "off";
      setVoiceStatus("off");
      setWakeRestartVersion(value => value + 1);
      setVoiceError("Không thể bắt đầu nhận giọng nói. Hãy thử lại hoặc nhập yêu cầu bằng bàn phím.");
    }
  };
  const voiceTurnBusy = isLoading && synced;
  useEffect(() => {
    if (!settingsReady || !settings.wakeWordEnabled || voiceTurnBusy || pendingVoiceCommand || isSpeaking || isViewingHistory || view !== "chat" || isSettingsDialogOpen) return;
    const contextError = voiceContextError();
    if (contextError) { setVoiceError(contextError); return; }
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Trình duyệt này chưa hỗ trợ nghe từ khóa “Hey Igen”. Bạn có thể dùng nút micro để đọc yêu cầu.");
      return;
    }
    let active = true;
    let paused = false;
    let restartTimer: number | null = null;
    let wakeText = "";
    let interimCommand = "";
    const spokenCommand = () => [commandTextRef.current, interimCommand].filter(Boolean).join(" ").trim();
    const cancelCommandTimer = () => {
      if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
    };
    const submitCommand = () => {
      const text = spokenCommand();
      cancelCommandTimer();
      if (!text) return;
      const current = recognitionRef.current;
      recognitionRef.current = null;
      voiceStatusRef.current = "off";
      commandTextRef.current = "";
      interimCommand = "";
      commandResultIndexRef.current = null;
      setVoiceStatus("off");
      setIsListening(false);
      setInput(text);
      current?.stop();
      setPendingVoiceCommand(text);
    };
    const scheduleCommand = () => {
      cancelCommandTimer();
      if (!spokenCommand()) return;
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
      const awaitingCommand = voiceStatusRef.current === "command";
      const recognition = new SpeechRecognition();
      recognition.lang = "vi-VN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
      voiceStatusRef.current = awaitingCommand ? "command" : "waiting";
      setVoiceStatus(awaitingCommand ? "command" : "waiting");
      setIsListening(awaitingCommand);
      recognition.onstart = () => setVoiceError("");
      recognition.onresult = event => {
        if (!active || recognitionRef.current !== recognition) return;
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          const transcript = result[0].transcript.trim();
          if (!transcript) continue;
          if (voiceStatusRef.current === "waiting") {
            const heard = [wakeText, transcript].filter(Boolean).join(" ");
            if (result.isFinal) wakeText = heard.slice(-100);
            const remainder = commandAfterWakeWord(heard);
            if (remainder === null) continue;
            wakeText = "";
            voiceStatusRef.current = "command";
            commandTextRef.current = remainder;
            commandResultIndexRef.current = index;
            setVoiceStatus("command");
            setIsListening(true);
            setVoiceError("");
            openChat();
            setInput(remainder);
            if (result.isFinal) commandResultIndexRef.current = null;
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
        }
        if (voiceStatusRef.current === "command") {
          interimCommand = interim;
          setInput(spokenCommand());
          scheduleCommand();
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
        if (voiceStatusRef.current === "command" && spokenCommand()) {
          submitCommand();
          return;
        }
        interimCommand = "";
        commandResultIndexRef.current = null;
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
  }, [settingsReady, settings.wakeWordEnabled, voiceTurnBusy, pendingVoiceCommand, isSpeaking, isViewingHistory, view, isSettingsDialogOpen, mode, wakeRestartVersion]);
  const decide = (confirmed: boolean) => {
    if (isViewingHistory || !lastReply?.action || isLoading || retryRef.current) return;
    stopReplySpeech();
    saveHistory([...messages, { role: "user", content: confirmed ? "Xác nhận thực hiện." : "Hủy thao tác.", createdAt: new Date().toISOString() }]);
    void submitTurn({ conversationId, requestId: crypto.randomUUID(), mode: assistantMode, decision: { id: lastReply.action.id, confirmed, ...(confirmed && lastReply.action.requiresPassword ? { password } : {}) } });
  };
  const startNew = () => {
    const id = crypto.randomUUID();
    try { localStorage.setItem(conversationKey, id); localStorage.removeItem(requestKey); } catch { /* Keep in memory. */ }
    closeSpeech(); stopReplySpeech(); retryRef.current = null; setIsViewingHistory(false); setView("chat"); setConversationId(id); setSynced(false); setLastReply(null); saveHistory([activeWelcomeMessage], true); setError(""); setInput(""); setAttachment(null); setAttachmentSubmitted(false); setAttachmentError(""); setVoiceError("");
    onAssistantModeChange(assistantMode);
  };

  const isWelcomeScreen = !isViewingHistory && messages.length === 1 && messages[0].role === "assistant" && messages[0].content === activeWelcomeMessage.content;
  const displayMessages = messages.filter((message, index) => !(index === 0 && message.role === "assistant" && message.content === activeWelcomeMessage.content));
  const showReplyDetails = !revealingReply;
  const hasMissingRequiredReferenceSelection = Boolean(lastReply?.referenceSelections?.some(group => group.required && !selectedReferences[group.key]?.length));
  const changeView = (nextView: "chat" | "history") => {
    if (nextView !== "chat") { closeSpeech(); stopReplySpeech(); }
    setView(nextView);
  };
  const openMode = (nextMode: AssistantMode) => {
    if (isLoading || retryRef.current) return;
    changeView("chat");
    if (assistantMode !== nextMode) onAssistantModeChange(nextMode);
  };
  const openAssistantInput = () => {
    openMode("work");
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
  const renderComposer = (placement: "landing" | "conversation") => <div className={cn("space-y-2", placement === "landing" ? "w-full text-left assistant-landing-composer-wrap" : "mx-auto w-full max-w-4xl")}>
    {error && <div className="space-y-1">
      <p id="erp-chatbot-error" role="alert" className="text-pretty text-sm text-error">{error}</p>
      <button type="button" onClick={() => { if (retryRef.current) void submitTurn(retryRef.current); else { setSynced(false); if (mode === "popup") { setIsOpen(false); document.getElementById("erp-chatbot-panel")?.hidePopover(); } } }} className={cn("rounded px-2 py-1 text-sm font-medium text-primary underline", focusClass)}>{retryRef.current ? "Kiểm tra lại yêu cầu" : mode === "popup" ? "Đóng và mở lại để tải" : "Thử tải lại"}</button>
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className={cn("border border-outline-variant bg-surface-container-lowest", placement === "landing" ? "assistant-landing-composer rounded-2xl p-3 shadow-sm sm:p-4" : "assistant-conversation-composer flex flex-wrap items-center gap-1 rounded-full px-2 py-1 shadow-sm")}>
      <label className="sr-only" htmlFor="erp-chatbot-input">Tin nhắn cho trợ lý ảo</label>
      <div className={cn("relative", placement === "conversation" && "order-2 min-w-0 flex-1")}>
        <textarea ref={inputRef} id="erp-chatbot-input" rows={placement === "landing" ? 2 : 1} autoFocus={mode !== "standalone"} onKeyDown={event => { if ((placement === "conversation" || settings.enterToSend) && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(); } }} value={input} onChange={(event) => setInput(event.target.value)} placeholder={placement === "landing" ? "" : promptPlaceholder} aria-describedby={["erp-chatbot-voice-help", placement === "conversation" && "erp-chatbot-keyboard-help", error && "erp-chatbot-error", voiceError && "erp-chatbot-voice-error"].filter(Boolean).join(" ")} className={cn("block w-full min-w-0 border-0 bg-transparent px-2 py-2 text-base text-on-surface placeholder:text-on-surface/60 focus-visible:outline-none focus-visible:ring-0", placement === "landing" ? "resize-none sm:text-lg" : "max-h-24 resize-none leading-6 focus-visible:bg-surface-container-low/40")} />
        {placement === "landing" && !input && <AssistantTypingPlaceholder key={assistantMode} text={promptPlaceholder} />}
      </div>
      {assistantMode === "work" && <input ref={attachmentInputRef} className="sr-only" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" aria-label="Chọn tệp CSV hoặc Excel" aria-describedby={`erp-chatbot-file-help${attachmentError ? " erp-chatbot-file-error" : ""}`} aria-invalid={Boolean(attachmentError)} tabIndex={-1} onChange={event => { void selectAttachment(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />}
      {assistantMode === "work" && attachment && <div className={cn("mx-1 mb-2 rounded-xl border border-outline-variant bg-surface-container-low p-3", placement === "conversation" && "order-5 w-full")}>
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
      {assistantMode === "work" && attachmentError && <p id="erp-chatbot-file-error" role="alert" className={cn("mx-2 mb-2 text-pretty text-sm text-error", placement === "conversation" && "order-6 w-full")}>{attachmentError}</p>}
      {assistantMode === "work" && isReadingAttachment && <p role="status" className={cn("mx-2 mb-2 text-sm text-on-surface/70", placement === "conversation" && "order-6 w-full")}>Đang đọc bảng dữ liệu…</p>}
      <div className={cn("assistant-composer-toolbar", placement === "landing" ? "flex items-center gap-2 border-t border-outline-variant px-1 pt-2" : "contents")}>
        {assistantMode === "work" && <button ref={attachmentButtonRef} type="button" aria-label="Đính kèm tệp CSV hoặc Excel" aria-describedby={`erp-chatbot-file-help${attachmentError ? " erp-chatbot-file-error" : ""}`} disabled={isLoading || !synced || isReadingAttachment || Boolean(retryRef.current)} onClick={() => attachmentInputRef.current?.click()} title="Tải bảng CSV hoặc Excel lên" className={cn("assistant-composer-tool flex shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40", placement === "landing" ? "size-10 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low" : "order-1 size-9 rounded-full border-0 bg-transparent hover:bg-surface-container-low", focusClass)}>
          {placement === "landing" ? <Paperclip className="size-4" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}
        </button>}
        <button type="button" onClick={() => toggleVoiceInput("manual")} aria-label={voiceStatus === "manual" ? "Dừng nhận giọng nói" : "Nhập yêu cầu bằng giọng nói"} aria-pressed={voiceStatus === "manual"} aria-describedby={voiceError ? "erp-chatbot-voice-error" : "erp-chatbot-voice-help"} disabled={isLoading || !synced || Boolean(retryRef.current)} title={voiceStatus === "manual" ? "Dừng và kiểm tra nội dung đã nhận" : "Nhập yêu cầu bằng giọng nói"} className={cn("assistant-composer-tool flex shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40", placement === "landing" ? "size-10 rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low" : "order-3 size-9 rounded-full border-0 bg-transparent hover:bg-surface-container-low", focusClass)}>
          {isListening ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => toggleVoiceInput("auto")} aria-label={voiceStatus === "auto" ? "Dừng và gửi yêu cầu thoại" : "Nói yêu cầu và tự gửi"} aria-pressed={voiceStatus === "auto"} aria-describedby={voiceError ? "erp-chatbot-voice-error" : "erp-chatbot-voice-help"} disabled={isLoading || !synced || Boolean(retryRef.current)} title={voiceStatus === "auto" ? "Dừng và gửi yêu cầu thoại" : "Nói yêu cầu và tự gửi"} className={cn("assistant-composer-tool assistant-live-voice-button flex shrink-0 items-center justify-center border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-40", placement === "landing" ? "size-10" : "order-4 size-9 rounded-full", focusClass)}><AssistantLiveVoiceIcon /></button>
        {placement === "landing" && <button type="submit" aria-label={isLoading ? "Đang chờ trợ lý trả lời" : "Gửi tin nhắn"} disabled={isLoading || !synced || isListening || Boolean(retryRef.current) || !input.trim()} className={cn("ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
          <SendHorizontal className="size-4" aria-hidden="true" />
        </button>}
      </div>
    </form>
    {placement === "conversation" && <p id="erp-chatbot-keyboard-help" className="sr-only">Nhấn Enter để gửi, Shift + Enter để xuống dòng.</p>}
    <p id="erp-chatbot-file-help" className="sr-only">Có thể tải tệp CSV, XLSX hoặc XLS, tối đa 100 dòng dữ liệu.</p>
    {voiceError && <p id="erp-chatbot-voice-error" role="alert" className="text-pretty text-sm text-error">{voiceError}</p>}
    {speechError && <p role="status" className="text-pretty text-sm text-error">{speechError}</p>}
    <p id="erp-chatbot-voice-help" role={voiceStatus !== "off" ? "status" : undefined} className={cn("text-pretty text-xs text-on-surface-variant", voiceStatus === "off" && "sr-only")}>{voiceStatus === "waiting" ? "Đang chờ “Hey Igen”. Hãy nói từ khóa rồi nêu yêu cầu." : voiceStatus === "command" || voiceStatus === "auto" ? "Đang nghe yêu cầu. Mình sẽ tự gửi khi bạn dừng nói." : voiceStatus === "manual" ? "Đang nghe tiếng Việt. Bấm micro để dừng và kiểm tra nội dung." : "Bạn có thể nhập hoặc nói yêu cầu; nội dung giọng nói sẽ được kiểm tra trước khi gửi."}</p>
  </div>;

  return <>
    {mode === "popup" && !headerPanel && <button
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
      {isOpen ? <X className="size-6" aria-hidden="true" /> : <AiAssistantIcon className="pointer-events-none size-10" />}
    </button>}
    <section
      id="erp-chatbot-panel"
      popover={mode === "popup" ? "manual" : undefined}
      role={mode === "popup" ? "dialog" : "region"}
      aria-labelledby="erp-chatbot-title"
      onToggle={mode === "popup" ? (event) => {
        const open = event.newState === "open";
        setIsOpen(open);
        if (open) event.currentTarget.querySelector<HTMLTextAreaElement | HTMLSelectElement>(view === "chat" ? "#erp-chatbot-input" : "select")?.focus({ preventScroll: true });
        if (!open) {
          closeSpeech(); stopReplySpeech();
          if (headerPanel) document.getElementById("header-assistant-trigger")?.focus({ preventScroll: true });
        }
      } : undefined}
      data-fullscreen={mode === "popup" && fullscreen}
      data-standalone={mode === "standalone"}
      data-header-panel={headerPanel}
      className="assistant-workspace m-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface p-0 text-on-surface shadow-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        {mode === "standalone" ? <h2 id="erp-chatbot-title" className="sr-only">Trợ lý ảo AI</h2> : <header className={cn("flex shrink-0 items-center justify-between border-b-2 py-2.5", headerPanel ? "assistant-popup-header gap-1 border-outline-variant px-3 text-on-surface" : "gap-2 border-outline-variant bg-surface-container-lowest px-4")}>
          <div className={cn("flex min-w-0 items-center", headerPanel ? "h-8 shrink-0 gap-2" : "gap-3")}>
            <AssistantHeaderAvatar />
            <div className={cn("flex min-w-0 items-center gap-1", headerPanel && "h-8")}>
              <h2 id="erp-chatbot-title" className={cn(headerPanel ? "shrink-0 whitespace-nowrap text-base font-semibold leading-5 text-on-surface" : "text-balance truncate text-lg font-bold text-on-surface")}>iGen AI</h2>
              <span role="img" aria-label="Trợ lý iGen đã xác minh" title="Trợ lý iGen đã xác minh" className="inline-flex size-5 shrink-0 items-center justify-center"><AssistantVerifiedBadge /></span>
            </div>
            {headerPanel && <StyledSelect value={assistantMode} options={assistantHeaderOptions} onChange={value => openMode(value as AssistantMode)} ariaLabel={`Chế độ iGen AI: ${assistantMode === "work" ? "Thao tác" : "Hỏi đáp"}`} menuLabel="Chọn chế độ" disabled={isLoading || Boolean(retryRef.current)} className="h-7 w-7 shrink-0 justify-center gap-0 rounded-md border-0 bg-transparent px-0 text-primary hover:bg-primary/10 [&>span]:sr-only" menuClassName="min-w-36 rounded-lg [&_[role=option]]:rounded-md" />}
          </div>
          <div className={cn("flex shrink-0 items-center text-primary", headerPanel ? "gap-0.5" : "gap-1")}>
            {headerPanel && <button type="button" aria-label="Lịch sử trò chuyện" title="Lịch sử trò chuyện" aria-pressed={view === "history"} onClick={() => changeView(view === "history" ? "chat" : "history")} className={cn("flex size-8 items-center justify-center rounded-lg hover:bg-primary/10", focusClass)}><History className="size-4" aria-hidden="true" /></button>}
            {isSpeaking && <><span role="status" className="sr-only">Đang tạo hoặc phát câu trả lời thành tiếng.</span><button type="button" aria-label="Dừng đọc câu trả lời" title="Dừng đọc câu trả lời" aria-pressed="true" onClick={stopReplySpeech} className={cn("flex items-center justify-center", headerPanel ? "size-8 rounded-lg hover:bg-primary/10" : "size-10 rounded-xl hover:bg-surface-container-high", focusClass)}><VolumeX className="size-4" aria-hidden="true" /></button></>}
            {mode === "popup" && <button type="button" aria-label={fullscreen ? "Thu về cửa sổ lớn" : "Mở toàn màn hình"} aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)} className={cn("hidden items-center justify-center sm:flex", headerPanel ? "size-8 rounded-lg hover:bg-primary/10" : "size-10 rounded-xl hover:bg-surface-container-high", focusClass)}>{fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}</button>}
            <button type="button" aria-label="Bắt đầu cuộc trò chuyện mới" title="Bắt đầu cuộc trò chuyện mới" disabled={isLoading || Boolean(retryRef.current) || messages.length <= 1} onClick={startNew} className={cn("flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40", headerPanel ? "size-8 rounded-lg hover:bg-primary/10" : "size-10 rounded-xl hover:bg-surface-container-high", focusClass)}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
            </button>
            {mode === "popup" ? <button type="button" popoverTarget="erp-chatbot-panel" popoverTargetAction="hide" aria-label="Thu gọn cửa sổ trò chuyện" className={cn("flex items-center justify-center", headerPanel ? "size-8 rounded-lg hover:bg-primary/10" : "size-10 rounded-xl hover:bg-surface-container-high", focusClass)}>
              <X className="size-5" aria-hidden="true" />
            </button> : <button type="button" onClick={returnToPreviousPage} aria-label="Quay lại trang trước" title="Quay lại trang trước" className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)}>
              <X className="size-5" aria-hidden="true" />
            </button>}
          </div>
        </header>}
        <div className="flex min-h-0 flex-1">
        <aside aria-label="Điều hướng trợ lý" style={{ "--assistant-rail-gradient": `url(#${railGradientId})` } as React.CSSProperties} className={cn("assistant-sidebar assistant-reference-sidebar shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest px-2 py-3", sidebarCollapsed && "is-collapsed")}>
          <svg className="absolute size-0" aria-hidden="true" focusable="false"><defs><linearGradient id={railGradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop offset="0%" stopColor="#00adfc" /><stop offset="55%" stopColor="#199bff" /><stop offset="100%" stopColor="#7567ff" /></linearGradient></defs></svg>
          <div className="assistant-sidebar-header relative mb-3 flex items-center justify-between gap-1.5">
            <button type="button" aria-label={sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!sidebarCollapsed} aria-controls="assistant-sidebar-navigation" onClick={() => setSidebarCollapsed(value => !value)} className={cn("assistant-sidebar-tool assistant-sidebar-collapse flex items-center justify-center rounded-lg hover:bg-surface-container-low", focusClass)}>{sidebarCollapsed ? <PanelLeftOpen className="size-5" aria-hidden="true" /> : <PanelLeftClose className="size-5" aria-hidden="true" />}</button>
            <button type="button" aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới" aria-hidden={sidebarCollapsed} tabIndex={sidebarCollapsed ? -1 : undefined} disabled={sidebarCollapsed || isLoading || Boolean(retryRef.current) || messages.length <= 1} onClick={startNew} className={cn("assistant-sidebar-tool assistant-sidebar-new-chat flex size-9 shrink-0 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:text-on-surface/35", focusClass)}><MessageSquarePlus className="size-5" aria-hidden="true" /></button>
          </div>
          <nav id="assistant-sidebar-navigation" className="flex flex-col gap-1.5" aria-label="Chế độ trợ lý">
            <button type="button" aria-label="Trò chuyện" aria-current={view === "chat" && assistantMode === "qa" ? "page" : undefined} disabled={isLoading || Boolean(retryRef.current)} onClick={() => openMode("qa")} className={cn("assistant-side-item", view === "chat" && assistantMode === "qa" && "is-active", focusClass)}><AssistantRailIcon name="chat" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Trò chuyện</span></button>
            <button type="button" disabled title="Chưa có tính năng AI Studio" className="assistant-side-item" aria-label="AI Studio (chưa có)"><AssistantRailIcon name="studio" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>AI Studio</span></button>
            <button type="button" disabled title="Chưa có tính năng Notebook" className="assistant-side-item" aria-label="Notebook (chưa có)"><AssistantRailIcon name="notebook" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Notebook</span></button>
            <button type="button" disabled title="Chưa có tính năng ghi chép cuộc họp" className="assistant-side-item" aria-label="Ghi chép cuộc họp (chưa có)"><AssistantRailIcon name="meeting" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Ghi chép cuộc họp</span></button>
            <button type="button" aria-label="Trợ lý AI" aria-current={view === "chat" && assistantMode === "work" ? "page" : undefined} disabled={isLoading || Boolean(retryRef.current)} onClick={openAssistantInput} className={cn("assistant-side-item", view === "chat" && assistantMode === "work" && "is-active", focusClass)}><AssistantRailIcon name="assistant" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Trợ lý AI</span></button>
            <button type="button" disabled title="Chưa có tính năng dự án" className="assistant-side-item" aria-label="Dự án (chưa có)"><AssistantRailIcon name="project" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Dự án</span></button>
            <button type="button" aria-label="Công cụ trợ lý" aria-haspopup="dialog" aria-controls="assistant-settings-dialog" onClick={() => { setWorkflowsVisited(true); setConfigView("workflows"); setIsSettingsDialogOpen(true); }} className={cn("assistant-side-item", focusClass)}><AssistantRailIcon name="tools" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Công cụ</span></button>
            <button type="button" aria-label="Lịch sử trò chuyện" aria-current={view === "history" ? "page" : undefined} onClick={() => changeView("history")} className={cn("assistant-side-item", view === "history" && "is-active", focusClass)}><AssistantRailIcon name="history" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Lịch sử</span></button>
          </nav>
          <div className="mt-auto border-t border-outline-variant pt-2"><button type="button" aria-label="Quản trị và thiết lập trợ lý" aria-haspopup="dialog" aria-controls="assistant-settings-dialog" aria-expanded={isSettingsDialogOpen} onClick={openSettings} className={cn("assistant-side-item", focusClass)}><AssistantRailIcon name="settings" /><span className="assistant-side-label" aria-hidden={sidebarCollapsed}>Quản trị và thiết lập</span></button></div>
        </aside>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {mode === "standalone" && isSpeaking && <div className="assistant-reference-top-actions flex items-center gap-1">
          <button type="button" aria-label="Dừng đọc câu trả lời" title="Dừng đọc câu trả lời" onClick={stopReplySpeech} className={cn("flex size-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest", focusClass)}><VolumeX className="size-4" aria-hidden="true" /></button>
        </div>}
        <nav aria-label="Chế độ trợ lý" className="assistant-mobile-mode-nav flex shrink-0 gap-1 border-b border-outline-variant bg-surface-container-lowest p-2">
          <button type="button" aria-pressed={view === "chat" && assistantMode === "qa"} disabled={isLoading || Boolean(retryRef.current)} onClick={() => openMode("qa")} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "chat" && assistantMode === "qa" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><MessageSquare className="size-4 shrink-0" aria-hidden="true" />Trò chuyện</span></button>
          <button type="button" aria-pressed={view === "chat" && assistantMode === "work"} disabled={isLoading || Boolean(retryRef.current)} onClick={openAssistantInput} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "chat" && assistantMode === "work" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><AssistantRailIcon name="assistant" />Trợ lý AI</span></button>
          <button type="button" aria-pressed={view === "history"} onClick={() => changeView("history")} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "history" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><History className="size-4 shrink-0" aria-hidden="true" />Lịch sử</span></button>
          <button type="button" aria-haspopup="dialog" aria-expanded={isSettingsDialogOpen} aria-controls="assistant-settings-dialog" onClick={openSettings} className={cn("min-w-0 flex-1 rounded-xl px-1 py-2 text-sm", isSettingsDialogOpen && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><Settings2 className="size-4 shrink-0" aria-hidden="true" />Cài đặt</span></button>
        </nav>
        <div hidden={view !== "history"} className={cn("min-h-0 flex-1 flex-col bg-surface-container-lowest", view === "history" && "flex")}>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-balance text-sm font-semibold">Các phiên trò chuyện</h3>
              <p className="text-pretty text-xs text-on-surface/70">Mở lại nội dung các phiên trước trong tài khoản này.</p>
            </div>
            <button type="button" aria-label="Tải lại lịch sử trò chuyện" title="Tải lại" onClick={() => setHistoryReload(value => value + 1)} disabled={historyLoading || historyLoadingMore} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface-container-high disabled:opacity-40", focusClass)}>
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div aria-busy={historyLoading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-container-lowest px-4">
            {historyLoading && <p role="status" className="p-3 text-sm text-on-surface/70">Đang tải lịch sử trò chuyện…</p>}
            {historyError && <div className="space-y-2 p-3"><p role="alert" className="text-pretty text-sm text-error">{historyError}</p><button type="button" onClick={() => setHistoryReload(value => value + 1)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focusClass)}>Thử tải lại</button></div>}
            {!historyLoading && !historyError && conversations.length === 0 && <div className="space-y-3 p-3">
              <p className="text-sm">Chưa có phiên trò chuyện nào để xem lại.</p>
              <button type="button" onClick={() => { setIsViewingHistory(false); setView("chat"); }} className={cn("rounded-xl bg-primary px-3 py-2 text-sm text-on-primary hover:bg-primary/90", focusClass)}>Bắt đầu trò chuyện</button>
            </div>}
            {(isLoading || retryRef.current) && <p role="status" className="p-3 text-pretty text-sm text-on-surface/70">Đợi yêu cầu hiện tại hoàn tất hoặc kiểm tra lại trước khi mở một phiên khác.</p>}
            {conversations.length > 0 && <ul className="divide-y divide-outline-variant" aria-label="Danh sách phiên trò chuyện">
              {conversations.map(conversation => <li key={conversation.conversationId} className="flex items-center gap-2">
                <button type="button" disabled={isLoading || Boolean(retryRef.current) || Boolean(deletingConversationId)} onClick={() => openPreviousConversation(conversation)} className={cn("min-w-0 flex-1 bg-transparent px-1 py-4 text-left hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 min-w-0 text-sm font-semibold">{conversation.title}</span>
                    <time className="shrink-0 text-xs tabular-nums text-on-surface/70" dateTime={conversation.updatedAt}>{formatConversationTime(conversation.updatedAt)}</time>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-pretty text-sm text-on-surface/80">{conversation.preview || "Chưa có nội dung tin nhắn."}</span>
                  <span className="mt-2 block text-xs tabular-nums text-on-surface/70">{conversation.messageCount} tin nhắn · {conversation.mode === "qa" ? "Hỏi đáp" : "Thao tác"}</span>
                </button>
                <button type="button" aria-label={`Xóa phiên trò chuyện: ${conversation.title}`} title="Xóa phiên trò chuyện" disabled={isLoading || Boolean(retryRef.current) || Boolean(deletingConversationId)} onClick={() => setPendingConversationDelete(conversation)} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>)}
            </ul>}
            {historyCursor && !historyLoading && <div className="flex justify-center p-3">
              <button type="button" onClick={() => void loadOlderConversations()} disabled={historyLoadingMore} className={cn("rounded-xl border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low disabled:opacity-50", focusClass)}>{historyLoadingMore ? "Đang tải…" : "Tải thêm phiên cũ"}</button>
            </div>}
          </div>
        </div>
        <ConfirmDialog isOpen={Boolean(pendingConversationDelete)} isSubmitting={Boolean(deletingConversationId)} title="Xóa phiên trò chuyện?" description={`Tin nhắn và ngữ cảnh riêng của phiên “${pendingConversationDelete?.title || "này"}” sẽ bị xóa vĩnh viễn.`} confirmLabel="Xóa phiên" onClose={() => setPendingConversationDelete(null)} onConfirm={deleteConversation} />
        <div hidden={view !== "chat"} className={cn("min-h-0 flex-1 flex-col", view === "chat" && "flex")}>
        {isViewingHistory && <div ref={historyBannerRef} tabIndex={-1} className={cn("shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-2 text-center", focusClass)}>
          <p className="text-pretty text-sm">Đang xem lại phiên cũ. Phiên này ở chế độ chỉ đọc.</p>
        </div>}
        {isWelcomeScreen ? headerPanel ? <div ref={logRef} className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-y-auto overscroll-contain bg-surface-container-lowest p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><h3 className="text-balance text-lg font-semibold text-on-surface">iGen AI</h3><AssistantVerifiedBadge /></div>
            <p className="text-pretty text-sm text-on-surface-variant">{assistantMode === "qa" ? "Mình có thể giải đáp câu hỏi về hệ thống và công việc của bạn." : "Mình có thể giúp bạn thực hiện công việc trong hệ thống. Mọi thay đổi đều cần bạn xác nhận."}</p>
            {isLoading && <p role="status" className="text-sm text-on-surface-variant">Đang tải cuộc trò chuyện…</p>}
          </div>
          {settings.showSuggestions && synced && <div aria-label="Gợi ý bắt đầu" className="flex flex-wrap gap-2">
            {(assistantMode === "qa" ? qaSuggestions : suggestions).slice(0, 3).map(({ prompt }) => <button key={prompt} type="button" onClick={() => void handleSend(prompt)} className={cn("rounded-md border border-outline-variant bg-surface px-2 py-1 text-left text-xs text-on-surface hover:border-primary focus:border-primary", focusClass)}>{prompt}</button>)}
          </div>}
          {renderComposer("conversation")}
        </div> : <div ref={logRef} className="assistant-welcome assistant-reference-welcome min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-8">
          <section aria-labelledby="assistant-welcome-title" className="assistant-reference-content mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-7 sm:gap-8">
            <div className="space-y-3 text-center">
              <h1 id="assistant-welcome-title" className="text-balance text-2xl font-semibold sm:text-3xl">{assistantMode === "work" ? <>Xin chào {userProfile?.displayName || "bạn"}, tôi giúp bạn thao tác trên <span className="assistant-brand-name">iGen</span></> : <>Xin chào {userProfile?.displayName || "bạn"}, mình là Trợ lí AI của <span className="assistant-brand-name">iGen</span></>} <span aria-hidden="true">👋</span></h1>
            </div>
            {isLoading && <p role="status" className="text-center text-sm text-on-surface/70">Đang tải cuộc trò chuyện…</p>}
            {renderComposer("landing")}
            <div className="assistant-quick-actions" aria-label="Tính năng AI">
              <button type="button" data-tone="cyan" disabled={!synced || isLoading || isReadingAttachment} onClick={() => { if (assistantMode === "work") attachmentInputRef.current?.click(); else openMode("work"); }} title={assistantMode === "qa" ? "Chuyển sang Trợ lý AI để phân tích tệp" : "Phân tích tệp"} className={cn("assistant-action-chip", focusClass)}><AssistantGradientIcon Icon={Paperclip} from="#1478dc" middle="#00adfc" to="#6859e4" className="size-4" />Phân tích tệp</button>
              <button type="button" data-tone="violet" disabled title="Trò chuyện thoại hai chiều với AI chưa có" className="assistant-action-chip is-preview"><AssistantVoiceChatIcon />iGen Voice</button>
              {previewActions.map(({ label, Icon, from, middle, to }) => <button key={label} type="button" disabled title={`${label} chưa có trong trợ lý`} className="assistant-action-chip is-preview"><AssistantGradientIcon Icon={Icon} from={from} middle={middle} to={to} className="size-4" />{label}</button>)}
            </div>
            {settings.showSuggestions && synced && <section aria-label={assistantMode === "qa" ? "Gợi ý câu hỏi" : "Gợi ý yêu cầu"} className="space-y-3">
              <div className="assistant-reference-suggestions grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {(assistantMode === "qa" ? qaSuggestions : suggestions).map(({ prompt, category, Icon }) => <button key={prompt} data-tone={category === "Nhân sự" ? "cyan" : category === "Khách hàng" ? "brand" : "violet"} type="button" onClick={() => void handleSend(prompt)} className={cn("assistant-promo-card group flex min-h-20 w-full items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 text-left hover:border-primary hover:bg-surface-container-low sm:p-4", focusClass)}>
                    <span className="assistant-promo-copy">
                      <span className="assistant-promo-title">{prompt}</span>
                      <span className="assistant-promo-cta">Thử ngay <ArrowUpRight className="size-3.5" aria-hidden="true" /></span>
                    </span>
                    <span className="assistant-promo-art" aria-hidden="true"><span className="assistant-promo-orbit" /><AssistantGradientIcon Icon={Icon} className="size-8" /><span className="assistant-promo-sparkle">✦</span></span>
                </button>)}
              </div>
            </section>}
          </section>
        </div> : <>
        <div ref={logRef} role="log" aria-label="Nội dung trò chuyện" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-container-lowest px-4 py-5 sm:px-8 sm:py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {displayMessages.map((message, index) => {
            const dateKey = messageLocalDateKey(message.createdAt);
            const previousDateKey = messageLocalDateKey(displayMessages[index - 1]?.createdAt);
            const dateLabel = messageDateLabel(message.createdAt);
            const time = messageTimeLabel(message.createdAt);
            return <React.Fragment key={index}>
          {dateKey && dateKey !== previousDateKey && <div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-outline-variant" aria-hidden="true" /><time dateTime={message.createdAt} className="text-xs font-medium text-on-surface-variant">{dateLabel}</time><span className="h-px flex-1 bg-outline-variant" aria-hidden="true" /></div>}
          <div className={cn("flex w-full items-start gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
            {message.role === "user" ? <div className="flex max-w-full flex-col items-end gap-1">
            {time && <time dateTime={message.createdAt} className="text-xs tabular-nums text-on-surface-variant">{time}</time>}
            <div className="max-w-3xl rounded-full bg-primary/10 px-3 py-2 text-sm leading-relaxed text-on-surface">
              <span className="sr-only">Bạn: </span>
              <p className="whitespace-pre-wrap break-words text-pretty" style={{ overflowWrap: "anywhere" }}>
                {message.content.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}
              </p>
            </div>
            </div> : <div className="min-w-0 w-full max-w-4xl">
              <div className="flex items-center gap-2">
                <p aria-hidden="true" className="assistant-message-author text-xs font-semibold">iGen AI</p>
                {time && <time dateTime={message.createdAt} className="text-xs tabular-nums text-on-surface-variant">{time}</time>}
              </div>
              <div className="mt-1.5 min-w-0 text-sm leading-relaxed text-on-surface">
                <span className="sr-only">iGen AI: </span>
                {revealingReply && !isViewingHistory && message === messages[messages.length - 1] && message.content === revealingReply.content
                  ? <RevealingAssistantMessage
                    key={revealingReply.requestId}
                    content={message.content}
                    requestId={revealingReply.requestId}
                    onProgress={followReplyReveal}
                    onComplete={finishReplyReveal}
                  />
                    : <div aria-hidden="true" className="assistant-message-final"><AssistantMessageContent content={message.content} /></div>}
              </div>
            </div>}
          </div>
          </React.Fragment>;
          })}
          {showReplyDetails && lastReply?.referenceSelections?.length ? <section aria-labelledby="assistant-reference-selection-title" className="max-w-4xl space-y-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm sm:p-4">
            <header>
              <h3 id="assistant-reference-selection-title" className="text-balance font-semibold">Chọn thông tin liên quan</h3>
              <p className="mt-1 text-pretty text-xs text-on-surface/70">Chọn ngay tại đây để tiếp tục. Mục tùy chọn có thể bỏ qua.</p>
            </header>
            <div className="space-y-3">
              {lastReply.referenceSelections.map((group, groupIndex) => {
                const useCheckboxes = group.multiple || !group.required;
                return <fieldset key={group.key} className="space-y-1.5">
                  <legend className="mb-1.5 font-medium">{group.label}<span className="ml-2 text-xs font-normal text-on-surface/70">{group.required ? "Bắt buộc" : "Tùy chọn"}{group.multiple ? " · Có thể chọn nhiều" : ""}</span></legend>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.options.map((option, optionIndex) => {
                      const id = `assistant-reference-${groupIndex}-${optionIndex}`;
                      const checked = Boolean(selectedReferences[group.key]?.includes(option.value));
                      return <li key={option.value}>
                        <label htmlFor={id} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface px-2.5 py-2 hover:bg-surface-container-low", focusClass, (isLoading || isViewingHistory || Boolean(retryRef.current)) && "cursor-not-allowed opacity-50")}>
                          <input id={id} type={useCheckboxes ? "checkbox" : "radio"} name={`assistant-reference-${groupIndex}`} value={option.value} checked={checked} disabled={isLoading || isViewingHistory || Boolean(retryRef.current)} onChange={event => toggleReferenceSelection(group.key, option.value, event.currentTarget.checked, group.multiple)} className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" />
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
            <button type="button" aria-describedby={hasMissingRequiredReferenceSelection ? "assistant-reference-selection-help" : undefined} disabled={isLoading || !synced || Boolean(retryRef.current) || hasMissingRequiredReferenceSelection} onClick={() => void submitReferenceSelections()} className={cn("min-h-10 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
              Dùng lựa chọn
            </button>
          </section> : null}
          {showReplyDetails && lastReply?.trainingContentForm && <AssistantTrainingContentForm
            key={lastReply.action?.id || "assistant-training-content"}
            value={lastReply.trainingContentForm}
            readOnly={isViewingHistory}
            submitting={isLoading || Boolean(retryRef.current)}
            canSubmit={synced && !isLoading && !retryRef.current}
            onSubmit={trainingContent => void submitTrainingContent(trainingContent)}
          />}
          {showReplyDetails && lastReply?.action && <section aria-label="Bản xem trước thao tác" className="max-w-4xl overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest text-sm">
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-3 py-2 sm:px-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{lastReply.status === "confirmation" ? "XEM LẠI TRƯỚC KHI XÁC NHẬN" : "THÔNG TIN THAO TÁC"}</p>
                <h3 className="mt-1 text-balance font-semibold">{lastReply.action.title}</h3>
              </div>
              {lastReply.status === "confirmation" && <span className="inline-flex shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs font-medium">Chờ xác nhận</span>}
            </header>
            {lastReply.action.values.length > 0 && <dl className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              {lastReply.action.values.map((item, index) => <div key={item.label} className={cn("min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5", lastReply.action!.values.length % 2 === 1 && index === lastReply.action!.values.length - 1 && "sm:col-span-2")}>
                <dt className="text-xs text-on-surface/70">{item.label}</dt>
                <dd className="mt-1 break-words font-medium tabular-nums">{String(item.value)}{item.defaulted ? " (mặc định)" : ""}</dd>
              </div>)}
            </dl>}
            {lastReply.status === "confirmation" && <div className="space-y-2 border-t border-outline-variant px-3 py-2 sm:px-4">
              <p className="text-pretty text-xs text-on-surface/70">Thao tác chưa được thực hiện. Kiểm tra lại thông tin rồi xác nhận để tiếp tục.</p>
              {lastReply.action.requiresPassword && <div className="space-y-1.5 text-sm"><label htmlFor="assistant-account-password" className="font-medium">Mật khẩu khởi tạo</label><input id="assistant-account-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="assistant-password-help" className={cn("min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface sm:max-w-sm", focusClass)} /><span id="assistant-password-help" className="block text-xs text-on-surface/70">Tối thiểu 6 ký tự. Mật khẩu không lưu trong hội thoại và không gửi cho AI.</span></div>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" disabled={isLoading || Boolean(retryRef.current) || (lastReply.action.requiresPassword && password.length < 6)} onClick={() => decide(true)} className={cn("min-h-10 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Xác nhận thực hiện</button>
                <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={() => decide(false)} className={cn("min-h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm font-medium hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Hủy thao tác</button>
              </div>
            </div>}
          </section>}
          {showReplyDetails && lastReply?.link && <a href={lastReply.link} className={cn("inline-block rounded px-2 py-1 text-sm text-primary underline", focusClass)}>Mở phân hệ để xem kết quả</a>}
          {isLoading && isOpen && <div role="status" aria-label={retryRef.current ? "Đang soạn câu trả lời" : "Đang tải cuộc trò chuyện"} className="assistant-thinking-status flex items-center py-1 text-on-surface-variant">
            <span className="assistant-thinking-dots" aria-hidden="true"><span /><span /><span /></span>
          </div>}
          </div>
        </div>
        <footer className="shrink-0 bg-surface-container-lowest px-3 py-2 sm:px-6">
          {isViewingHistory ? <div className="space-y-2 text-center">
            {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
            <p className="text-pretty text-xs text-on-surface/70">Bạn có thể xem lại nội dung trước, hoặc tiếp tục làm việc trong chính phiên này.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={continuePreviousConversation} className={cn("min-h-9 rounded-lg bg-primary px-3 py-1.5 text-sm text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>Tiếp tục phiên này</button>
              <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={startNew} className={cn("min-h-9 rounded-lg border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>Bắt đầu cuộc trò chuyện mới</button>
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
                {settingsError ? <div className="space-y-2 p-4"><p role="alert" className="text-sm text-error">{settingsError}</p><button type="button" onClick={() => setSettingsRetry(value => value + 1)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focusClass)}>Thử tải cài đặt lại</button></div> : !settingsReady ? <p role="status" className="p-4 text-sm">Đang tải cài đặt…</p> : configView === "memory" && <AssistantMemoryManager enabled={settings.memoryEnabled} conversationId={conversationId} branchId={branchId} />}
              </div>
            </div>
          </div>
        </dialog>
      </div>
    </section>
  </>;
}
