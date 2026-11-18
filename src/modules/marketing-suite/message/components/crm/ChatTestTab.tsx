import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Plus, Settings2, X } from "lucide-react";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { ErpRefreshButton } from "../../../../../components/common/ErpRefreshButton";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { OmniChatTab } from "./OmniChatTab";
import { chatTestService, type ChatTestState } from "../../services/chatTestService";
import type { AIChatConfig, ChatMessage, CustomerInbox } from "../../types/crm";
import type { ChatTestSession } from "../../../../../../shared/marketing-suite/chat-test";
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
        documentDomain,
      });
      setSessions(current => [session, ...current]);
      setSelectedId(session.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được hội thoại."); }
    finally { setCreating(false); }
  }
  const customers = useMemo<CustomerInbox[]>(() => sessions.map(session => ({
    id: session.id, name: session.label, avatar: "NB", lastMessage: "", time: "",
    unreadCount: 0, isVip: false, status: "online", tags: [], channel: session.channel,
    accountId: `chat-test:${session.id}`, lastMessageAt: new Date(session.createdAt),
  })), [sessions]);
  const selectedSession = sessions.find(session => session.id === selectedId);

  return <div className="flex h-full min-h-0 flex-col bg-surface">
    <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant p-3">
      <h2 data-typography="page-title" className="mr-auto text-balance text-lg font-semibold">Thử nghiệm chat</h2>
      {selectedSession && <span className="text-sm text-on-surface-variant" role="status">
        Đang thử: {selectedSession.documentDomain === "telecom" ? "Nhà mạng" : "Thông thường"}
      </span>}
      <StyledSelect ariaLabel="Loại hội thoại mới" appearance="erp" value={documentDomain} disabled={creating}
        className="w-44 max-w-full" options={[{ value: "general", label: "Thông thường" }, { value: "telecom", label: "Nhà mạng" }]}
        onChange={value => setDocumentDomain(value === "telecom" ? "telecom" : "general")} />
      <StyledSelect ariaLabel="Lấy cấu hình ban đầu từ" appearance="erp" value={source} onChange={setSource} disabled={creating}
        className="w-64" options={[{ value: "personal", label: "Cấu hình AI của tôi" },
          ...accounts.filter(account => account.platform !== "tiktok").map(account => ({
            value: `${account.platform}:${account.accountId}`, label: account.displayName,
          }))]} />
      <button type="button" className={primaryCreateButtonClass} disabled={creating} onClick={() => void create()}>
        <Plus className="size-4" aria-hidden="true" /> {creating ? "Đang tạo…" : "Hội thoại mới"}
      </button>
      <ErpRefreshButton loading={loading} onClick={() => { setLoading(true); setReload(value => value + 1); }} />
    </div>
    {error && <p role="alert" className="px-3 py-2 text-pretty text-sm text-error">{error}</p>}
    <div className="min-h-0 flex-1 overflow-hidden">
      <DirectConversation key={selectedId || "empty"} id={selectedId} customers={customers} loading={loading}
        onSelect={setSelectedId} onConfigureLead={onConfigureLead} settingsRevision={settingsRevision} />
    </div>
  </div>;
}

function DirectConversation({ id, customers, loading, onSelect, onConfigureLead, settingsRevision }: {
  id: string; customers: CustomerInbox[]; loading: boolean; onSelect: (id: string) => void;
  onConfigureLead: (scope: string) => void; settingsRevision: number;
}) {
  const [data, setData] = useState<ChatTestState>();
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
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
  const pendingSend = useRef<{ key: string; text: string; file?: File }>(null);
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
        setError("");
        if (next.session.pending) timer = setTimeout(load, 1500);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được hội thoại."); }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, refresh, settingsRevision]);
  const imageKey = data?.messages.filter(message => message.hasImage).map(message => message.id).join(",") || "";
  useEffect(() => {
    const controller = new AbortController();
    for (const messageId of imageKey.split(",").filter(Boolean)) {
      if (imageUrls.current[messageId]) continue;
      void chatTestService.image(id, messageId, controller.signal).then(blob => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        imageUrls.current[messageId] = url;
        setImages(current => ({ ...current, [messageId]: url }));
      }).catch(() => { if (!controller.signal.aborted) setError("Không tải được ảnh trong hội thoại."); });
    }
    return () => controller.abort();
  }, [id, imageKey]);
  useEffect(() => () => { Object.values(imageUrls.current).forEach(URL.revokeObjectURL); }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const pending = data?.session.pending === true;
  const last = data?.messages.at(-1);
  const history: ChatMessage[] = data?.messages.flatMap(message => [
    { id: message.id, sender: "user" as const, text: message.text, timestamp: new Date(message.createdAt),
      ...(images[message.id] ? { attachments: [{ type: "image", url: images[message.id] }] } : {}) },
    ...(message.reply ? [{ id: message.id + "-reply", sender: "ai" as const, text: message.reply, timestamp: new Date(message.createdAt) }] : []),
  ]) || [];
  function choose(files: File[]) {
    if (!files.length) return;
    if (!id || !data || sending || pending) {
      setError("Chờ hội thoại sẵn sàng và chatbot trả lời xong trước khi thêm ảnh."); return;
    }
    if (files.length !== 1) {
      setError("Mỗi lượt gửi một ảnh. Bạn chọn hoặc thả từng ảnh nhé."); return;
    }
    const file = files[0];
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      setError("Chọn ảnh JPEG, PNG, WebP hoặc GIF tối đa 8 MB."); return;
    }
    setFile(file); setError("");
  }
  function hasDraggedFiles(transfer: DataTransfer) {
    return Array.from(transfer.types).includes("Files") || transfer.files.length > 0;
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!id || sending || pending || (!draft.trim() && !file)) return;
    const request = pendingSend.current?.text === draft && pendingSend.current.file === file
      ? pendingSend.current : { key: crypto.randomUUID(), text: draft, file };
    pendingSend.current = request; setSending(true); setError("");
    try {
      await chatTestService.send(id, request.key, draft.trim(), file);
      pendingSend.current = null; setDraft(""); setFile(undefined);
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
      typeMessage={draft} setTypeMessage={setDraft} aiWaiting={sending || pending}
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
        scopeKey: id || "internal", hasAttachment: Boolean(file),
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
          if (id && data && !sending && !pending) setDraggingImage(true);
        },
        onDragOver: event => {
          if (!hasDraggedFiles(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = id && data && !sending && !pending ? "copy" : "none";
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
          <input type="file" ref={upload} className="sr-only" tabIndex={-1} accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="Chọn ảnh gửi cho chatbot" aria-describedby={attachmentHintId} disabled={sending || pending} onChange={event => choose(Array.from(event.target.files || []))} />
          <button type="button" className={buttonClass} aria-describedby={attachmentHintId} disabled={sending || pending} onClick={() => upload.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" /> Gửi ảnh
          </button>
          <p id={attachmentHintId} className="text-pretty text-xs text-on-surface-variant">Kéo thả ảnh vào hội thoại hoặc Ctrl+V để dán ảnh · Tối đa 8 MB/ảnh</p>
          {preview && <><img src={preview} alt="Ảnh sắp gửi" className="size-14 rounded object-contain" />
            <button type="button" className={buttonClass} disabled={sending || pending} aria-label="Bỏ ảnh đã chọn"
              onClick={() => { setFile(undefined); if (upload.current) upload.current.value = ""; }}><X className="size-4" aria-hidden="true" /></button></>}
        </div>,
        status: <div className="mb-2 space-y-1 text-xs">
          {error && <p role="alert" className="text-pretty text-error">{error}</p>}
          {last?.status === "completed" && last.error && <p role="status" className="text-on-surface-variant">{last.error}</p>}
          {pending && <p role="status" className="text-on-surface-variant">{phases[last?.phase || ""] || "Đang chờ chatbot…"}</p>}
          {last?.status === "failed" && <div><p role="alert" className="text-error">{last.error}</p>
            <button type="button" className={buttonClass} disabled={sending || pending} onClick={() => {
              void chatTestService.retry(id, last.id).then(() => setRefresh(value => value + 1))
                .catch(cause => setError(cause instanceof Error ? cause.message : "Không thử lại được."));
            }}>Thử lại</button></div>}
        </div>,
      }} />
  </>;
}
