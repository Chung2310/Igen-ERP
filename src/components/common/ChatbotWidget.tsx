import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, History, Maximize2, MessageSquare, MessageSquarePlus, Mic, MicOff, Minimize2, RefreshCw, SendHorizontal, Settings2, VolumeX, X } from "lucide-react";
import { assistantService, type AssistantConversationCursor, type AssistantConversationSummary, type AssistantTurnInput } from "../../services/assistantService";
import { defaultAssistantSettings, type AssistantSettings } from "../../shared/assistant-workflow";
import { AssistantSettingsEditor } from "./AssistantSettingsEditor";
import "./ChatbotWidget.css";
import type { AssistantReply } from "../../shared/assistant-workflow";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import { getPosTerminalId } from "../../modules/retail/posTerminal";
import { AssistantWorkflowEditor } from "./AssistantWorkflowEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { cn } from "../../modules/student-management/lib/utils";

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

interface Message {
  role: "user" | "assistant";
  content: string;
}

const welcomeMessage: Message = {
  role: "assistant",
  content: "Chào bạn! Tôi là trợ lý ảo AI của iGen ERP. Tôi có thể thực hiện các thao tác theo workflow riêng của bạn. Hãy nêu yêu cầu; nếu thiếu thông tin, tôi sẽ hỏi bổ sung trước khi thực hiện.",
};
const suggestions = ["Thêm nhân sự Đỗ Đức Chung", "Tạo khách hàng mới", "Tạo một công việc mới"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function readHistory(key: string): Message[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(saved) && saved.length && saved.every((message) =>
      message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")) {
      return saved;
    }
  } catch { /* Storage may be unavailable; chat still works for this session. */ }
  return [welcomeMessage];
}

function formatConversationTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function ChatbotWidget({ storageScope }: { storageScope: string }) {
  const { userProfile } = useAuth();
  const branch = useBranchOptional();
  const scope = `${storageScope}:${branch?.activeBranchId || "company"}`;
  const branchId = branch?.activeBranchId || "";
  const deviceId = userProfile?.companyCode && branchId ? getPosTerminalId(userProfile.companyCode, branchId) : undefined;
  return <ChatbotSession key={scope} storageScope={scope} branchId={branchId} deviceId={deviceId} />;
}

function storedConversation(key: string): string {
  try { const saved = localStorage.getItem(key); if (saved && /^[a-f\d-]{36}$/i.test(saved)) return saved; } catch { /* Use this session. */ }
  const id = crypto.randomUUID();
  try { localStorage.setItem(key, id); } catch { /* Use this session. */ }
  return id;
}

function ChatbotSession({ storageScope, branchId, deviceId }: { storageScope: string; branchId: string; deviceId?: string }) {
  const storageKey = `igen_erp_chatbot_history:${storageScope}`;
  const conversationKey = `${storageKey}:conversation`;
  const requestKey = `${storageKey}:request`;
  const [conversationId, setConversationId] = useState(() => storedConversation(conversationKey));
  const [settings, setSettings] = useState<AssistantSettings>(defaultAssistantSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsRetry, setSettingsRetry] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [configView, setConfigView] = useState<"workflows" | "settings">("workflows");
  useEffect(() => {
    const controller = new AbortController();
    setSettingsError("");
    void assistantService.settings(controller.signal).then(value => {
      if (!controller.signal.aborted) { setSettings(value); setFullscreen(value.windowMode === "fullscreen"); setSettingsReady(true); }
    }).catch(cause => { if (!controller.signal.aborted) setSettingsError((cause as Error).message); });
    return () => controller.abort();
  }, [settingsRetry]);
  const [password, setPassword] = useState("");
  const [view, setView] = useState<"chat" | "history" | "workflows">("chat");
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [historyCursor, setHistoryCursor] = useState<AssistantConversationCursor | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyReload, setHistoryReload] = useState(0);
  const [lastReply, setLastReply] = useState<AssistantReply | null>(null);
  const [workflowsVisited, setWorkflowsVisited] = useState(false);
  const [synced, setSynced] = useState(false);
  const retryRef = useRef<AssistantTurnInput | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechBaseRef = useRef("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const pendingSpeechVoiceWaitRef = useRef<(() => void) | null>(null);
  const closeSpeech = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) recognition.abort();
    setIsListening(false);
  }, []);
  const stopReplySpeech = useCallback(() => {
    pendingSpeechVoiceWaitRef.current?.();
    pendingSpeechVoiceWaitRef.current = null;
    const utterance = speechUtteranceRef.current;
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    }
    speechUtteranceRef.current = null;
    setIsSpeaking(false);
  }, []);
  const speakReply = useCallback((text: string) => {
    if (!settings.speakReplies) return;
    if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      setSpeechError("Trình duyệt này chưa hỗ trợ đọc câu trả lời thành tiếng.");
      return;
    }
    stopReplySpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";
    const synthesis = window.speechSynthesis;
    const findVietnameseVoice = () => synthesis.getVoices().find(item => item.lang.toLocaleLowerCase().startsWith("vi"));
    const voice = findVietnameseVoice();
    if (voice) {
      utterance.voice = voice;
    } else {
      // Browsers such as Chrome may return no voices until they finish loading them.
      // Wait briefly for a Vietnamese voice before falling back to the utterance's vi-VN locale.
      let timeoutId: number | undefined;
      let waiting = true;
      const clearVoiceWait = () => {
        if (!waiting) return;
        waiting = false;
        synthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        if (pendingSpeechVoiceWaitRef.current === clearVoiceWait) pendingSpeechVoiceWaitRef.current = null;
      };
      const startSpeech = (allowFallback: boolean) => {
        if (!waiting) return;
        const loadedVoice = findVietnameseVoice();
        if (!loadedVoice && !allowFallback) return;
        clearVoiceWait();
        if (loadedVoice) utterance.voice = loadedVoice;
        synthesis.speak(utterance);
      };
      const handleVoicesChanged = () => startSpeech(false);
      synthesis.addEventListener("voiceschanged", handleVoicesChanged);
      pendingSpeechVoiceWaitRef.current = clearVoiceWait;
      timeoutId = window.setTimeout(() => startSpeech(true), 1500);
    }
    utterance.onend = () => {
      if (speechUtteranceRef.current !== utterance) return;
      speechUtteranceRef.current = null;
      setIsSpeaking(false);
    };
    utterance.onerror = event => {
      if (speechUtteranceRef.current !== utterance) return;
      speechUtteranceRef.current = null;
      setIsSpeaking(false);
      if (event.error !== "canceled" && event.error !== "interrupted") setSpeechError("Không thể phát câu trả lời thành tiếng. Bạn vẫn có thể đọc nội dung trong khung chat.");
    };
    speechUtteranceRef.current = utterance;
    setSpeechError("");
    setIsSpeaking(true);
    if (voice) synthesis.speak(utterance);
  }, [settings.speakReplies, stopReplySpeech]);
  const applySettings = (value: AssistantSettings) => {
    setSettings(value);
    setFullscreen(value.windowMode === "fullscreen");
    if (!value.speakReplies) { stopReplySpeech(); setSpeechError(""); }
  };
  const [messages, setMessages] = useState<Message[]>(() => readHistory(storageKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const historyBannerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const closeConfirmation = useCallback(() => setShowConfirmClear(false), []);

  useEffect(() => () => {
    requestRef.current?.abort();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    if (speechUtteranceRef.current) {
      pendingSpeechVoiceWaitRef.current?.();
      pendingSpeechVoiceWaitRef.current = null;
      speechUtteranceRef.current.onend = null;
      speechUtteranceRef.current.onerror = null;
      speechUtteranceRef.current = null;
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    }
  }, []);
  useEffect(() => {
    if (isOpen && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, isLoading, isOpen]);

  const saveHistory = (next: Message[], persist = !isViewingHistory) => {
    setMessages(next);
    if (!persist) return;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep in memory. */ }
  };

  const submitTurn = async (request: AssistantTurnInput) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    retryRef.current = request;
    try { localStorage.setItem(requestKey, JSON.stringify({ ...request, decision: request.decision ? { id: request.decision.id, confirmed: request.decision.confirmed } : undefined })); } catch { /* Keep in memory. */ }
    setError(""); setIsLoading(true);
    try {
      let result = await assistantService.turn(request, controller.signal, branchId, deviceId);
      for (let attempt = 0; result.status === "processing" && attempt < 40 && !controller.signal.aborted; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (controller.signal.aborted) return;
        result = await assistantService.turn(request, controller.signal, branchId, deviceId);
      }
      if (result.status === "processing") throw new Error("Yêu cầu vẫn đang xử lý. Bấm kiểm tra lại để lấy kết quả của cùng yêu cầu, tránh tạo trùng.");
      if (controller.signal.aborted) return;
      setLastReply(result);
      speakReply(result.reply);
      setPassword("");
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
      saveHistory(state.messages.length ? state.messages : [welcomeMessage], !isViewingHistory);
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
    if (view === "chat" && isViewingHistory) historyBannerRef.current?.focus({ preventScroll: true });
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

  const openPreviousConversation = (id: string) => {
    if (isLoading || retryRef.current) return;
    closeSpeech();
    stopReplySpeech();
    setIsViewingHistory(true);
    setConversationId(id);
    setSynced(false);
    setLastReply(null);
    setPassword("");
    setInput("");
    setError("");
    setView("chat");
  };

  const handleSend = async (textToSend = input) => {
    const text = textToSend.trim();
    if (isViewingHistory || !text || isLoading || !synced || isListening || retryRef.current) return;
    stopReplySpeech();
    saveHistory([...messages, { role: "user", content: text }]);
    setInput(""); setLastReply(null); setVoiceError("");
    await submitTurn({ conversationId, requestId: crypto.randomUUID(), text });
  };
  const toggleVoiceInput = () => {
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
      setInput(current => current.trim() ? current : speechBaseRef.current);
    };
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError("Không thể bắt đầu nhận giọng nói. Hãy thử lại hoặc nhập yêu cầu bằng bàn phím.");
    }
  };
  const decide = (confirmed: boolean) => {
    if (isViewingHistory || !lastReply?.action || isLoading || retryRef.current) return;
    stopReplySpeech();
    saveHistory([...messages, { role: "user", content: confirmed ? "Xác nhận thực hiện." : "Hủy thao tác." }]);
    void submitTurn({ conversationId, requestId: crypto.randomUUID(), decision: { id: lastReply.action.id, confirmed, ...(confirmed && lastReply.action.requiresPassword ? { password } : {}) } });
  };
  const startNew = () => {
    const id = crypto.randomUUID();
    try { localStorage.setItem(conversationKey, id); localStorage.removeItem(requestKey); } catch { /* Keep in memory. */ }
    closeSpeech(); stopReplySpeech(); retryRef.current = null; setIsViewingHistory(false); setConversationId(id); setSynced(false); setLastReply(null); saveHistory([welcomeMessage], true); setError(""); setInput(""); setVoiceError(""); closeConfirmation();
  };

  const isWelcomeScreen = !isViewingHistory && messages.length === 1 && messages[0].role === "assistant" && messages[0].content === welcomeMessage.content;
  const changeView = (nextView: "chat" | "history") => {
    if (nextView !== "chat") { closeSpeech(); stopReplySpeech(); }
    setView(nextView);
  };
  const openSettings = () => {
    closeSpeech(); stopReplySpeech(); setWorkflowsVisited(true); setConfigView("settings"); setView("workflows");
  };
  const renderComposer = (placement: "landing" | "conversation") => <div className={cn("space-y-2", placement === "landing" ? "w-full text-left" : "mx-auto w-full max-w-4xl")}>
    {error && <div className="space-y-1">
      <p id="erp-chatbot-error" role="alert" className="text-pretty text-sm text-error">{error}</p>
      <button type="button" onClick={() => { if (retryRef.current) void submitTurn(retryRef.current); else { setSynced(false); setIsOpen(false); document.getElementById("erp-chatbot-panel")?.hidePopover(); } }} className={cn("rounded px-2 py-1 text-sm font-medium text-primary underline", focusClass)}>{retryRef.current ? "Kiểm tra lại yêu cầu" : "Đóng và mở lại để tải"}</button>
    </div>}
    <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className={cn("rounded-2xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30", placement === "landing" ? "p-3 shadow-sm sm:p-4" : "p-2")}>
      <label className="sr-only" htmlFor="erp-chatbot-input">Tin nhắn cho trợ lý ảo</label>
      <textarea id="erp-chatbot-input" rows={placement === "landing" ? 3 : 2} autoFocus onKeyDown={event => { if (settings.enterToSend && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(); } }} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Bạn muốn thực hiện việc gì?" aria-describedby={["erp-chatbot-voice-help", error && "erp-chatbot-error", voiceError && "erp-chatbot-voice-error"].filter(Boolean).join(" ")} className={cn("block w-full min-w-0 resize-y border-0 bg-transparent px-2 py-2 text-base text-on-surface placeholder:text-on-surface/60 focus-visible:outline-none focus-visible:ring-0", placement === "landing" && "sm:text-lg")} />
      <div className="flex items-center gap-2 border-t border-outline-variant px-1 pt-2">
        <button type="button" onClick={toggleVoiceInput} aria-label={isListening ? "Dừng nhận giọng nói" : "Nhập yêu cầu bằng giọng nói"} aria-pressed={isListening} aria-describedby={voiceError ? "erp-chatbot-voice-error" : "erp-chatbot-voice-help"} disabled={isLoading || !synced || Boolean(retryRef.current)} title={isListening ? "Dừng và kiểm tra nội dung đã nhận" : "Nhập yêu cầu bằng giọng nói"} className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
          {isListening ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
        </button>
        <p className="hidden min-w-0 flex-1 truncate text-left text-xs text-on-surface/70 sm:block">{settings.enterToSend ? "Enter để gửi · Shift + Enter để xuống dòng" : "Enter để xuống dòng · Nhấn gửi để thực hiện"}</p>
        <button type="submit" aria-label={isLoading ? "Đang chờ trợ lý trả lời" : "Gửi tin nhắn"} disabled={isLoading || !synced || isListening || Boolean(retryRef.current) || !input.trim()} className={cn("ml-auto flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
          <SendHorizontal className="size-5" aria-hidden="true" />
        </button>
      </div>
    </form>
    {voiceError && <p id="erp-chatbot-voice-error" role="alert" className="text-pretty text-sm text-error">{voiceError}</p>}
    {speechError && <p role="status" className="text-pretty text-sm text-error">{speechError}</p>}
    <p id="erp-chatbot-voice-help" role={isListening ? "status" : undefined} className="text-left text-xs text-on-surface/70">{isListening ? "Đang nghe tiếng Việt. Dừng để kiểm tra nội dung rồi gửi." : "Bạn có thể nhập hoặc nói yêu cầu; nội dung giọng nói sẽ được kiểm tra trước khi gửi."}</p>
  </div>;

  return <>
    <button
      type="button"
      popoverTarget="erp-chatbot-panel"
      aria-label={isOpen ? "Thu gọn trợ lý ảo AI" : "Mở trợ lý ảo AI"}
      aria-expanded={isOpen}
      aria-controls="erp-chatbot-panel"
      title="Trợ lý ảo AI"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))", right: "calc(1rem + env(safe-area-inset-right))" }}
      className={cn("fixed z-40 flex size-14 items-center justify-center rounded-full border border-outline-variant bg-primary text-on-primary shadow-lg hover:bg-primary/90", focusClass)}
    >
      {isOpen ? <X className="size-6" aria-hidden="true" /> : <Bot className="size-6" aria-hidden="true" />}
    </button>
    <section
      id="erp-chatbot-panel"
      popover="auto"
      role="dialog"
      aria-labelledby="erp-chatbot-title"
      onToggle={(event) => {
        const open = event.newState === "open";
        setIsOpen(open);
        if (open) event.currentTarget.querySelector<HTMLTextAreaElement | HTMLSelectElement>(view === "chat" ? "#erp-chatbot-input" : "select")?.focus({ preventScroll: true });
        if (!open) { setShowConfirmClear(false); closeSpeech(); stopReplySpeech(); }
      }}
      data-fullscreen={fullscreen}
      className="assistant-workspace m-0 overflow-hidden rounded-2xl border border-outline-variant bg-surface p-0 text-on-surface shadow-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><Bot className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-surface/70">iGen ERP</p>
              <h2 id="erp-chatbot-title" className="text-balance truncate text-sm font-semibold">Trợ lý ảo AI</h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isSpeaking && <><span role="status" className="sr-only">Đang đọc câu trả lời thành tiếng.</span><button type="button" aria-label="Dừng đọc câu trả lời" title="Dừng đọc câu trả lời" aria-pressed="true" onClick={stopReplySpeech} className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)}><VolumeX className="size-4" aria-hidden="true" /></button></>}
            <button type="button" aria-label={fullscreen ? "Thu về cửa sổ lớn" : "Mở toàn màn hình"} aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)} className={cn("hidden size-10 items-center justify-center rounded-xl hover:bg-surface-container-high sm:flex", focusClass)}>{fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}</button>
            <button type="button" aria-label="Bắt đầu cuộc trò chuyện mới" title="Bắt đầu cuộc trò chuyện mới" disabled={isLoading || Boolean(retryRef.current) || messages.length <= 1} onClick={() => setShowConfirmClear(true)} className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>
              <MessageSquarePlus className="size-4" aria-hidden="true" />
            </button>
            <button type="button" popoverTarget="erp-chatbot-panel" popoverTargetAction="hide" aria-label="Thu gọn cửa sổ trò chuyện" className={cn("flex size-10 items-center justify-center rounded-xl hover:bg-surface-container-high", focusClass)}>
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
        <aside aria-label="Điều hướng trợ lý" className="assistant-sidebar w-60 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low px-3 py-4">
          <p className="px-3 pb-2 text-xs font-medium text-on-surface/70">KHÔNG GIAN LÀM VIỆC</p>
          <nav className="flex flex-col gap-1" aria-label="Chế độ trợ lý">
            <button type="button" aria-pressed={view === "chat"} onClick={() => changeView("chat")} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", view === "chat" && "bg-surface-container-high font-semibold", focusClass)}><MessageSquare className="size-4 shrink-0" aria-hidden="true" />Trò chuyện</button>
            <button type="button" aria-pressed={view === "history"} onClick={() => changeView("history")} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", view === "history" && "bg-surface-container-high font-semibold", focusClass)}><History className="size-4 shrink-0" aria-hidden="true" />Lịch sử phiên</button>
          </nav>
          <div className="mt-auto border-t border-outline-variant pt-3">
            <button type="button" aria-pressed={view === "workflows" && configView === "settings"} onClick={openSettings} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", view === "workflows" && configView === "settings" && "bg-surface-container-high font-semibold", focusClass)}><Settings2 className="size-4 shrink-0" aria-hidden="true" />Cài đặt trợ lý</button>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <nav aria-label="Chế độ trợ lý" className="assistant-mobile-mode-nav flex shrink-0 gap-1 border-b border-outline-variant bg-surface-container-lowest p-2">
          <button type="button" aria-pressed={view === "chat"} onClick={() => changeView("chat")} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "chat" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><MessageSquare className="size-4 shrink-0" aria-hidden="true" />Trò chuyện</span></button>
          <button type="button" aria-pressed={view === "history"} onClick={() => changeView("history")} className={cn("min-w-0 flex-1 rounded-xl px-2 py-2 text-sm", view === "history" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><History className="size-4 shrink-0" aria-hidden="true" />Lịch sử</span></button>
          <button type="button" aria-pressed={view === "workflows" && configView === "settings"} onClick={openSettings} className={cn("min-w-0 flex-1 rounded-xl px-1 py-2 text-sm", view === "workflows" && configView === "settings" && "bg-surface-container-high font-semibold", focusClass)}><span className="inline-flex items-center justify-center gap-1.5"><Settings2 className="size-4 shrink-0" aria-hidden="true" />Cài đặt</span></button>
        </nav>
        <div hidden={view !== "workflows"} className={cn("min-h-0 flex-1 flex-col", view === "workflows" && "flex")}>
          <nav aria-label="Cấu hình cá nhân" className="flex shrink-0 flex-wrap gap-2 border-b border-outline-variant p-2">
            <button type="button" aria-pressed={configView === "workflows"} onClick={() => setConfigView("workflows")} className={cn("rounded-xl px-3 py-2 text-sm", configView === "workflows" && "bg-surface-container-high font-semibold", focusClass)}>Workflow nghiệp vụ</button>
            <button type="button" aria-pressed={configView === "settings"} onClick={() => setConfigView("settings")} className={cn("rounded-xl px-3 py-2 text-sm", configView === "settings" && "bg-surface-container-high font-semibold", focusClass)}>Cài đặt trợ lý</button>
          </nav>
          <div hidden={configView !== "workflows"} className={cn("min-h-0 flex-1 flex-col", configView === "workflows" && "flex")}>{workflowsVisited && <AssistantWorkflowEditor />}</div>
          <div hidden={configView !== "settings"} className={cn("min-h-0 flex-1 flex-col", configView === "settings" && "flex")}>
            {settingsError ? <div className="space-y-2 p-4"><p role="alert" className="text-sm text-error">{settingsError}</p><button type="button" onClick={() => setSettingsRetry(value => value + 1)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focusClass)}>Thử tải cài đặt lại</button></div> : !settingsReady ? <p role="status" className="p-4 text-sm">Đang tải cài đặt…</p> : <AssistantSettingsEditor settings={settings} onSave={applySettings} />}
          </div>
        </div>
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
                <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={() => openPreviousConversation(conversation.conversationId)} className={cn("w-full rounded-xl border border-outline-variant bg-surface p-3 text-left hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 min-w-0 text-sm font-semibold">{conversation.title}</span>
                    <time className="shrink-0 text-xs tabular-nums text-on-surface/70" dateTime={conversation.updatedAt}>{formatConversationTime(conversation.updatedAt)}</time>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-pretty text-sm text-on-surface/80">{conversation.preview || "Chưa có nội dung tin nhắn."}</span>
                  <span className="mt-2 block text-xs tabular-nums text-on-surface/70">{conversation.messageCount} tin nhắn</span>
                </button>
              </li>)}
            </ul>}
            {historyCursor && !historyLoading && <div className="flex justify-center p-3">
              <button type="button" onClick={() => void loadOlderConversations()} disabled={historyLoadingMore} className={cn("rounded-xl border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low disabled:opacity-50", focusClass)}>{historyLoadingMore ? "Đang tải…" : "Tải thêm phiên cũ"}</button>
            </div>}
          </div>
        </div>
        <div hidden={view !== "chat"} className={cn("min-h-0 flex-1 flex-col", view === "chat" && "flex")}>
        {isViewingHistory && <div ref={historyBannerRef} tabIndex={-1} className={cn("shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-2", focusClass)}>
          <p className="text-pretty text-sm">Đang xem lại phiên cũ. Phiên này ở chế độ chỉ đọc.</p>
        </div>}
        {isWelcomeScreen ? <div ref={logRef} className="assistant-welcome min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 sm:px-8">
          <section aria-labelledby="assistant-welcome-title" className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-6 text-center sm:gap-8">
            <div className="space-y-3">
              <p className="text-sm font-medium text-primary">TRỢ LÝ AI · IGEN ERP</p>
              <h1 id="assistant-welcome-title" className="text-balance text-2xl font-semibold sm:text-3xl">Xin chào, tôi có thể giúp gì cho bạn?</h1>
              <p className="mx-auto max-w-2xl text-pretty text-sm text-on-surface/70 sm:text-base">Mô tả công việc bằng ngôn ngữ tự nhiên. Tôi sẽ hỏi thêm khi thiếu thông tin và xin xác nhận trước khi cập nhật dữ liệu.</p>
            </div>
            {isLoading && <p role="status" className="text-sm text-on-surface/70">Đang tải cuộc trò chuyện…</p>}
            {renderComposer("landing")}
            {settings.showSuggestions && synced && <section aria-label="Gợi ý yêu cầu" className="space-y-3">
              <h2 className="text-balance text-sm font-medium">Bắt đầu với một yêu cầu</h2>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void handleSend(suggestion)} className={cn("max-w-full rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-left text-sm hover:bg-surface-container-low", focusClass)}>{suggestion}</button>)}
              </div>
            </section>}
          </section>
        </div> : <>
        <div ref={logRef} role="log" aria-label="Nội dung trò chuyện" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {messages.filter((message, index) => !(index === 0 && message.role === "assistant" && message.content === welcomeMessage.content)).map((message, index) => <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed", message.role === "user" ? "rounded-br-none bg-primary text-on-primary" : "rounded-bl-none bg-surface-container-low text-on-surface")}>
              <span className="sr-only">{message.role === "user" ? "Bạn: " : "Trợ lý: "}</span>
              <p className="whitespace-pre-wrap break-words text-pretty" style={{ overflowWrap: "anywhere" }}>
                {message.content.split(/(\*\*.*?\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}
              </p>
            </div>
          </div>)}
          {lastReply?.action && <section aria-label="Thông tin thao tác" className="space-y-2 rounded-xl border border-outline-variant p-3 text-sm">
            <h3 className="text-balance font-semibold">{lastReply.action.title}</h3>
            <dl className="space-y-1">{lastReply.action.values.map(item => <div key={item.label} className="break-words"><dt className="inline text-on-surface/70">{item.label}: </dt><dd className="inline">{String(item.value)}{item.defaulted ? " (mặc định)" : ""}</dd></div>)}</dl>
            {lastReply.status === "confirmation" && lastReply.action.requiresPassword && <div className="space-y-1 text-sm"><label htmlFor="assistant-account-password">Mật khẩu khởi tạo</label><input id="assistant-account-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="assistant-password-help" className={cn("w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-base text-on-surface", focusClass)} /><span id="assistant-password-help" className="block text-xs text-on-surface/70">Tối thiểu 6 ký tự. Mật khẩu không lưu trong hội thoại và không gửi cho AI.</span></div>}
            {lastReply.status === "confirmation" && <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" disabled={isLoading || Boolean(retryRef.current) || (lastReply.action.requiresPassword && password.length < 6)} onClick={() => decide(true)} className={cn("rounded-xl bg-primary px-3 py-2 text-on-primary disabled:opacity-40", focusClass)}>Xác nhận thực hiện</button>
              <button type="button" disabled={isLoading || Boolean(retryRef.current)} onClick={() => decide(false)} className={cn("rounded-xl border border-outline-variant px-3 py-2 disabled:opacity-40", focusClass)}>Hủy thao tác</button>
            </div>}
          </section>}
          {lastReply?.link && <a href={lastReply.link} className={cn("inline-block rounded px-2 py-1 text-sm text-primary underline", focusClass)}>Mở phân hệ để xem kết quả</a>}
          {isLoading && <p role="status" className="text-sm text-on-surface/70">Trợ lý đang xử lý yêu cầu…</p>}
          </div>
        </div>
        <footer className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-3 py-3 sm:px-6">
          {isViewingHistory ? <div className="space-y-2">
            {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
            <p className="text-xs text-on-surface/70">Không thể tiếp tục thao tác từ phiên xem lại. Hãy bắt đầu phiên mới nếu muốn làm việc tiếp.</p>
            <button type="button" onClick={() => setShowConfirmClear(true)} className={cn("rounded-xl bg-primary px-3 py-2 text-sm text-on-primary hover:bg-primary/90", focusClass)}>Bắt đầu cuộc trò chuyện mới</button>
          </div> : renderComposer("conversation")}
        </footer>
        </>}
        </div>
        </div>
        </div>
        <ConfirmDialog isOpen={showConfirmClear} title="Bắt đầu cuộc trò chuyện mới?" description="Bạn sẽ bắt đầu yêu cầu mới. Thao tác đã thực hiện vẫn giữ nguyên; thông tin đang thu thập sẽ không được chuyển sang cuộc trò chuyện mới." confirmLabel="Bắt đầu mới" onClose={closeConfirmation} onConfirm={startNew} />
      </div>
    </section>
  </>;
}
