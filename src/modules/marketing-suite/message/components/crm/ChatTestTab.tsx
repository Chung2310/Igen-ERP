import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Plus, Settings2, X } from "lucide-react";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { ErpRefreshButton } from "../../../../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { OmniChatTab } from "./OmniChatTab";
import { chatTestService, type ChatTestState } from "../../services/chatTestService";
import type { AIChatConfig, ChatMessage, CustomerInbox } from "../../types/crm";
import { CHAT_TEST_MAX_IMAGES, CHAT_TEST_MAX_IMAGE_BYTES, type ChatTestSession } from "../../../../../../shared/marketing-suite/chat-test";
import type { LeadAccountOption } from "./leadSheetUtils";

const buttonClass = "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const defaultConfig: AIChatConfig = {
  enabled: true, autoClassify: true, autoCloseDeal: true, autoFeedback: true, replyDelay: 1,
  advancedInstructions: "", trainingKnowledge: "",
};
const phases: Record<string, string> = {
  ocr: "Đang đọc ảnh và ghi Lead…", context: "Đang lấy kho tri thức…",
  lead: "Đang thu thập Lead…", reply: "Đang soạn câu trả lời…",
};

interface Props {
  accounts: LeadAccountOption[];
  onConfigureLead: (scope: string) => void;
  settingsRevision?: number;
  initialConversationId?: string;
}

export function ChatTestTab({ accounts, onConfigureLead, settingsRevision = 0, initialConversationId }: Props) {
  const [sessions, setSessions] = useState<ChatTestSession[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId || "");
  const [source, setSource] = useState("personal");
  const [documentDomain, setDocumentDomain] = useState<"general" | "telecom">("general");
  const [creating, setCreating] = useState(false);
  const [changingDomain, setChangingDomain] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void chatTestService.list(controller.signal).then(items => {
      if (controller.signal.aborted) return;
      setSessions(items);
      setSelectedId(current => current || initialConversationId || items[0]?.id || "");
      setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được hội thoại."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, initialConversationId]);
  useEffect(() => { if (initialConversationId) setSelectedId(initialConversationId); }, [initialConversationId]);
  async function create() {
    setCreating(true);
    setError("");
    const account = accounts.find(item => `${item.platform}:${item.accountId}` === source);
    try {
      const session = await chatTestService.create({
        channel: account?.platform === "zalo" ? "zalo" : "facebook",
        ...(account ? { sourceAccountId: account.accountId } : {}), ocrEnabled: false,
        documentDomain: selectedSession?.documentDomain || documentDomain,
      });
      setSessions(current => [session, ...current]);
      setSelectedId(session.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được hội thoại."); }
    finally { setCreating(false); }
  }
  const onSessionLoaded = useCallback((session: ChatTestSession) => {
    setSessions(current => current.some(item => item.id === session.id)
      ? current.map(item => item.id === session.id ? session : item) : [session, ...current]);
  }, []);
  async function changeDomain(value: string) {
    const next = value === "telecom" ? "telecom" : "general";
    if (!selectedId) { setDocumentDomain(next); return; }
    if (next === (selectedSession?.documentDomain || "general")) return;
    setChangingDomain(true); setError("");
    try {
      const saved = await chatTestService.setDomain(selectedId, next);
      onSessionLoaded(saved);
      setDocumentDomain(next);
      setSessionRevision(current => current + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đổi được chế độ hội thoại."); }
    finally { setChangingDomain(false); }
  }
  const customers = useMemo<CustomerInbox[]>(() => sessions.map(session => ({
    id: session.id, name: session.label, avatar: "NB", lastMessage: "", time: "",
    unreadCount: 0, isVip: false, status: "online", tags: [], channel: session.channel,
    accountId: `chat-test:${session.id}`, lastMessageAt: new Date(session.createdAt),
  })), [sessions]);
  const selectedSession = sessions.find(session => session.id === selectedId);

  return <div className="flex h-full min-h-0 flex-col bg-surface">
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-outline-variant p-3">
      {selectedSession && <span className="mr-auto text-sm text-on-surface-variant" role="status">
        Đang thử: {selectedSession.documentDomain === "telecom" ? "Nhà mạng" : "Thông thường"}
      </span>}
      <StyledSelect ariaLabel="Chế độ hội thoại" appearance="erp" value={selectedSession?.documentDomain || documentDomain} disabled={creating || changingDomain || loading || selectedSession?.pending}
        className="w-44 max-w-full" options={[{ value: "general", label: "Thông thường" }, { value: "telecom", label: "Nhà mạng" }]}
        onChange={value => { void changeDomain(value); }} />
      <StyledSelect ariaLabel="Lấy cấu hình ban đầu từ" appearance="erp" value={source} onChange={setSource} disabled={creating}
        className="w-64" options={[{ value: "personal", label: "Cấu hình AI của tôi" },
          ...accounts.filter(account => account.platform !== "tiktok").map(account => ({
            value: `${account.platform}:${account.accountId}`, label: account.displayName,
          }))]} />
      <button type="button" className={primaryCreateButtonClass} disabled={creating || changingDomain} onClick={() => void create()}>
        <Plus className="size-4" aria-hidden="true" /> {creating ? "Đang tạo…" : "Hội thoại mới"}
      </button>
      <ErpRefreshButton loading={loading} onClick={() => { setLoading(true); setReload(value => value + 1); }} />
    </div>
    {error && <p role="alert" className="px-3 py-2 text-pretty text-sm text-error">{error}</p>}
    <div className="min-h-0 flex-1 overflow-hidden">
      <DirectConversation key={selectedId || "empty"} id={selectedId} customers={customers} loading={loading}
        onSelect={setSelectedId} onConfigureLead={onConfigureLead} settingsRevision={settingsRevision}
        sessionRevision={sessionRevision + reload} switchingDomain={changingDomain} onSessionLoaded={onSessionLoaded} />
    </div>
  </div>;
}

function DirectConversation({ id, customers, loading, onSelect, onConfigureLead, settingsRevision, sessionRevision, switchingDomain, onSessionLoaded }: {
  id: string; customers: CustomerInbox[]; loading: boolean; onSelect: (id: string) => void;
  onConfigureLead: (scope: string) => void; settingsRevision: number; sessionRevision: number; switchingDomain: boolean;
  onSessionLoaded: (session: ChatTestSession) => void;
}) {
  const [data, setData] = useState<ChatTestState>();
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [channel, setChannel] = useState<"all" | "facebook" | "zalo" | "tiktok">("all");
  const [images, setImages] = useState<Record<string, string>>({});
  const imageUrls = useRef<Record<string, string>>({});
  const upload = useRef<HTMLInputElement>(null);
  const attachmentHintId = useId();
  const dragDepth = useRef(0);
  const pendingSend = useRef<{ key: string; text: string; files: File[] }>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (document.hidden) { timer = setTimeout(load, 2000); return; }
      try {
        const next = await chatTestService.read(id, controller.signal);
        if (controller.signal.aborted) return;
        setData(next);
        onSessionLoaded(next.session);
        setError("");
        if (next.session.pending) timer = setTimeout(load, 1500);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được hội thoại."); }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, refresh, settingsRevision, sessionRevision, onSessionLoaded]);
  const imageKey = data?.messages.flatMap(message => Array.from({ length: message.imageCount ?? (message.hasImage ? 1 : 0) }, (_, index) => `${message.id}:${index}`)).join(",") || "";
  useEffect(() => {
    const controller = new AbortController();
    for (const key of imageKey.split(",").filter(Boolean)) {
      if (imageUrls.current[key]) continue;
      const [messageId, index] = key.split(":");
      void chatTestService.image(id, messageId, controller.signal, Number(index)).then(blob => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        imageUrls.current[key] = url;
        setImages(current => ({ ...current, [key]: url }));
      }).catch(() => { if (!controller.signal.aborted) setError("Không tải được ảnh trong hội thoại."); });
    }
    return () => controller.abort();
  }, [id, imageKey]);
  useEffect(() => () => { Object.values(imageUrls.current).forEach(URL.revokeObjectURL); }, []);
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);
  const pending = data?.session.pending === true;
  const busy = sending || pending || switchingDomain;
  const last = data?.messages.at(-1);
  const history: ChatMessage[] = data?.messages.flatMap(message => [
    { id: message.id, sender: "user" as const, text: message.text, timestamp: new Date(message.createdAt),
      attachments: Array.from({ length: message.imageCount ?? (message.hasImage ? 1 : 0) }, (_, index) => images[`${message.id}:${index}`])
        .flatMap(url => url ? [{ type: "image", url }] : []) },
    ...(message.reply ? [{ id: message.id + "-reply", sender: "ai" as const, text: message.reply, timestamp: new Date(message.createdAt) }] : []),
  ]) || [];
  function choose(incoming: File[]) {
    if (!incoming.length) return;
    if (!id || !data || busy) {
      setError("Chờ hội thoại sẵn sàng và chatbot trả lời xong trước khi thêm ảnh."); return;
    }
    const next = [...new Set([...files, ...incoming])];
    if (next.length > CHAT_TEST_MAX_IMAGES) {
      setError("Mỗi lượt gửi tối đa 3 ảnh."); return;
    }
    if (next.some(file => !/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > CHAT_TEST_MAX_IMAGE_BYTES)) {
      setError("Chọn ảnh JPEG, PNG, WebP hoặc GIF tối đa 8 MB."); return;
    }
    if (next.reduce((sum, file) => sum + file.size, 0) > CHAT_TEST_MAX_IMAGE_BYTES) {
      setError("Tổng dung lượng ảnh mỗi lượt tối đa 8 MB."); return;
    }
    setFiles(next); setError("");
  }
  function hasDraggedFiles(transfer: DataTransfer) {
    return Array.from(transfer.types).includes("Files") || transfer.files.length > 0;
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!id || busy || (!draft.trim() && !files.length)) return;
    const request = pendingSend.current?.text === draft && pendingSend.current.files === files
      ? pendingSend.current : { key: crypto.randomUUID(), text: draft, files };
    pendingSend.current = request; setSending(true); setError("");
    try {
      await chatTestService.send(id, request.key, draft.trim(), files.length === 1 ? files[0] : files.length ? files : undefined);
      pendingSend.current = null; setDraft(""); setFiles([]);
      if (upload.current) upload.current.value = "";
      setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được tin nhắn."); }
    finally { setSending(false); }
  }
  const active = customers.find(customer => customer.id === id) || (data ? {
    id, name: data.session.label, avatar: "NB", time: "", lastMessage: "", unreadCount: 0,
    isVip: false, status: "online" as const, tags: [], channel: data.session.channel,
  } : null);

  return <>
    <OmniChatTab inboxCustomers={customers} activeCustomer={active} chatHistory={history}
      chatPagination={{ limit: 100, hasMore: false, nextBefore: null, loadingMore: false }}
      typeMessage={draft} setTypeMessage={setDraft} aiWaiting={busy}
      aiConfig={data?.aiConfig || defaultConfig} setAIConfig={async config => {
        const saved = await chatTestService.saveConfig(id, config);
        setData(current => current ? { ...current, aiConfig: saved } : current);
      }}
      handleSelectCustomer={customer => onSelect(customer.id)} handleSendChatMessage={send}
      handleLoadOlderMessages={() => {}} linkedLead={data?.leads[0] || null}
      onCreateLeadFromChat={() => { void chatTestService.createLead(id).then(() => setRefresh(value => value + 1))
        .catch(cause => setError(cause instanceof Error ? cause.message : "Không tạo được Lead.")); }}
      facebookPages={[]} selectedFacebookPageId="" selectedZaloAccountId="" selectedTiktokAccountId=""
      setSelectedFacebookPageId={() => {}} activeChannel={channel} setActiveChannel={setChannel}
      isFbConnected isZaloConnected isInboxLoading={loading || Boolean(id && !data)}
      directChat={{
        scopeKey: id || "internal", hasAttachment: files.length > 0,
        configScopeLabel: data?.session.sourceAccountId
          ? `Lưu thay đổi vào cấu hình ${data.session.channel === "zalo" ? "Zalo OA" : "Facebook Page"} ${data.session.sourceAccountId}.`
          : "Lưu thay đổi vào cấu hình AI cá nhân của bạn.",
        onPreview: (message, images) => chatTestService.preview(id, message, images),
        headerActions: <button type="button" className={buttonClass} aria-haspopup="dialog" onClick={() =>
          onConfigureLead(data?.session.sourceAccountId ? `${data.session.channel}:${data.session.sourceAccountId}` : "company")}>
          <Settings2 className="size-4" aria-hidden="true" /> Thiết lập Lead
        </button>,
        onPaste: event => {
          const items = Array.from(event.clipboardData.items || []).flatMap(item => {
            const file = item.kind === "file" ? item.getAsFile() : null;
            return file ? [file] : [];
          });
          const files = items.length ? items : Array.from(event.clipboardData.files || []);
          if (!files.length) return;
          event.preventDefault();
          choose(files);
        },
        onDragEnter: event => {
          if (!hasDraggedFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepth.current++;
          if (id && data && !busy) setDraggingImage(true);
        },
        onDragOver: event => {
          if (!hasDraggedFiles(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = id && data && !busy ? "copy" : "none";
        },
        onDragLeave: event => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDraggingImage(false);
        },
        onDrop: event => {
          if (!hasDraggedFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDraggingImage(false);
          choose(Array.from(event.dataTransfer.files));
        },
        dropOverlay: draggingImage && <div role="status" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-surface-container-lowest/95 p-4 text-center text-sm font-medium text-on-surface">
          Thả ảnh để đính kèm vào tin nhắn
        </div>,
        composer: <div className="mb-2 flex flex-wrap items-center gap-2">
          <input type="file" multiple ref={upload} className="sr-only" tabIndex={-1} accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Chọn ảnh gửi cho chatbot" aria-describedby={attachmentHintId} disabled={busy} onChange={event => choose(Array.from(event.target.files || []))} />
          <button type="button" className={buttonClass} aria-describedby={attachmentHintId} disabled={busy} onClick={() => upload.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" /> Gửi ảnh
          </button>
          <p id={attachmentHintId} className="text-pretty text-xs text-on-surface-variant">Kéo thả hoặc Ctrl+V để thêm ảnh · Tối đa 3 ảnh, tổng 8 MB mỗi lượt</p>
          {previews.map((preview, index) => <div key={index} className="flex items-center gap-1">
            <img src={preview} alt={index === 0 ? "Ảnh sắp gửi" : `Ảnh sắp gửi ${index + 1}`} className="size-14 rounded object-contain" />
            <button type="button" className={buttonClass} disabled={busy} aria-label={`Bỏ ảnh ${index + 1}`}
              onClick={() => { setFiles(current => current.filter((_, position) => position !== index)); if (upload.current) upload.current.value = ""; }}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>)}
        </div>,
        status: <div className="mb-2 space-y-1 text-xs">
          {switchingDomain && <p role="status" className="text-on-surface-variant">Đang đổi chế độ hội thoại…</p>}
          {data?.session.documentDomain === "telecom" && data.session.leadSetup?.ready === false && <div className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-low p-3">
            <p role="status" className="text-pretty text-on-surface">{data.session.leadSetup.message} Ảnh chưa được lưu vào Lead khi chưa có bộ cột phù hợp.</p>
            <button type="button" className={buttonClass} aria-haspopup="dialog" onClick={() =>
              onConfigureLead(data.session.sourceAccountId ? `${data.session.channel}:${data.session.sourceAccountId}` : "company")}>
              Mở thiết lập cột Lead
            </button>
          </div>}
          {error && <p role="alert" className="text-pretty text-error">{error}</p>}
          {last?.status === "completed" && last.error && <p role="status" className="text-on-surface-variant">{last.error}</p>}
          {pending && <p role="status" className="text-on-surface-variant">{phases[last?.phase || ""] || "Đang chờ chatbot…"}</p>}
          {last?.status === "failed" && <div><p role="alert" className="text-error">{last.error}</p>
            <button type="button" className={buttonClass} disabled={busy} onClick={() => {
              void chatTestService.retry(id, last.id).then(() => setRefresh(value => value + 1))
                .catch(cause => setError(cause instanceof Error ? cause.message : "Không thử lại được."));
            }}>Thử lại</button></div>}
        </div>,
      }} />
  </>;
}
