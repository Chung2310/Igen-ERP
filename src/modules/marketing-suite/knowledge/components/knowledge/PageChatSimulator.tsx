import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Send, Settings2, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getAccessToken } from "../../../shared/services/authService";
import { useAuth } from "../../../shared/context/AuthContext";
import { StyledSelect } from "../../../../../components/common/StyledSelect";

type SavedRecords = { customer?: { id: string; name: string; phone: string }; order?: { id: string; orderCode: string; status: string; paymentStatus: string; total: number } };
type Turn = { role: "customer" | "bot"; text: string; stage?: string; nextStep?: string; sources?: string[]; mode?: "ai" | "rule_demo"; persisted?: SavedRecords };
type Conversation = { id: string; title: string; pageName: string; pageId?: string; rule?: string; mode?: "simulation" | "erp"; turns: Turn[]; updatedAt?: number };
type Reply = { text: string; stage: string; nextStep: string; sources: string[]; mode?: "ai" | "rule_demo"; persisted?: SavedRecords };
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const makeConversation = (pageName = "Page mô phỏng", pageId = new URLSearchParams(window.location.search).get("pageId") || ""): Conversation => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "Cuộc trò chuyện mới", pageName, pageId, turns: [], updatedAt: Date.now(),
  mode: "simulation",
});
async function replyToCustomer(message: string, history: Turn[], documentText: string, rule: string, pageId: string | undefined,
  mode: "simulation" | "erp", conversationKey: string, turnId: string): Promise<Reply> {
  const response = await fetch(`/api/v1/company-knowledge/${mode === "erp" ? "simulate-page-chat-real" : "simulate-page-chat"}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify(mode === "erp"
      ? { message, pageId: pageId?.trim(), conversationKey, turnId }
      : { message, history: history.map(({ role, text }) => ({ role, text })), documentText, rule, pageId: pageId?.trim() || undefined }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể mô phỏng câu trả lời.");
  return result.data;
}
export function PageChatSimulator({ toolbarContainer }: { toolbarContainer: HTMLDivElement | null }) {
  const { userProfile } = useAuth();
  const storageKey = `marketing-page-chat-sim:${userProfile?.companyCode || "unknown"}`;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]") as Conversation[];
      if (Array.isArray(saved)) {
        const withMessages = saved.filter(item => Array.isArray(item.turns) && item.turns.length > 0);
        if (withMessages.length !== saved.length) localStorage.setItem(storageKey, JSON.stringify(withMessages));
        if (withMessages.length) {
          setConversations(withMessages);
          setActiveId(withMessages[0].id);
          return;
        }
      }
    } catch { /* Invalid old browser data starts a fresh simulation. */ }
    const first = makeConversation(); setConversations([first]); setActiveId(first.id);
  }, [storageKey]);
  const active = conversations.find(item => item.id === activeId);
  const recentConversations = conversations.filter(item => item.turns.length > 0);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [activeId, active?.turns.length, busy]);
  function save(next: Conversation[]) {
    const ordered = [...next].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setConversations(ordered);
    localStorage.setItem(storageKey, JSON.stringify(ordered.filter(item => item.turns.length > 0)));
  }
  function createConversation() {
    const next = makeConversation(active?.pageName, active?.pageId);
    next.rule = active?.rule;
    save([next, ...conversations.filter(item => item.turns.length > 0)]);
    setActiveId(next.id); setDraft(""); setError("");
  }
  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 30_000 || !/\.(md|txt)$/i.test(file.name)) { setError("Chọn tệp .md hoặc .txt tối đa 30 KB."); return; }
    try { setDocumentText(await file.text()); setDocumentName(file.name); setError(""); }
    catch { setError("Không đọc được tệp mô phỏng."); }
  }
  async function send() {
    if (!active || !draft.trim() || busy) return;
    const message = draft.trim();
    const id = active.id;
    const history = active.turns;
    const mode = active.mode || "simulation";
    const turnId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraft(""); setBusy(true); setError("");
    save(conversations.map(item => item.id === id ? { ...item, title: item.turns.length ? item.title : message.slice(0, 45), turns: [...item.turns, { role: "customer", text: message }], updatedAt: Date.now() } : item));
    try {
      const reply = await replyToCustomer(message, history, documentText, active.rule || "", active.pageId, mode, id, turnId);
      setConversations(current => {
        const next = current.map(item => item.id === id ? { ...item, turns: [...item.turns, { role: "bot" as const, ...reply }], updatedAt: Date.now() } : item).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        localStorage.setItem(storageKey, JSON.stringify(next.filter(item => item.turns.length > 0))); return next;
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể mô phỏng câu trả lời."); }
    finally { setBusy(false); }
  }
  const button = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
  const showModeHint = Boolean(active?.turns.length || active?.mode === "erp");
  const pageIdMissing = active?.mode === "erp" && !active.pageId?.trim();
  return (
    <section aria-label="Chatbot Page" className="flex min-h-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
      {toolbarContainer && createPortal(
        <>
          <span className="text-xs font-medium text-on-surface-variant">Chế độ chat</span>
          <StyledSelect
            value={active?.mode || "simulation"}
            disabled={Boolean(active?.turns.length)}
            onChange={value => save(conversations.map(item => item.id === activeId
              ? { ...item, mode: value as "simulation" | "erp" } : item))}
            ariaLabel="Chế độ chat"
            describedBy={showModeHint ? "page-sim-mode-hint" : undefined}
            className="w-72 max-w-full"
            options={[
              { value: "simulation", label: "Mô phỏng · không lưu" },
              { value: "erp", label: "Chạy thật · lưu khách và đơn vào ERP" },
            ]}
          />
          {showModeHint && (
            <p id="page-sim-mode-hint" className="max-w-xl text-pretty text-xs text-on-surface-variant">
              {active?.turns.length
                ? "Chế độ đã khóa cho cuộc trò chuyện này. Tạo cuộc trò chuyện mới để đổi chế độ."
                : "Dùng Page và flow đang lưu. Đơn chỉ được tạo sau khi khách xác nhận; đơn ở trạng thái nháp, chưa thanh toán. Không gửi tin hoặc QR ra Facebook."}
            </p>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={createConversation} className={cn(button, "shrink-0")}>
              <span aria-hidden="true">+</span> Tạo cuộc trò chuyện
            </button>
            <details className="group relative z-20 shrink-0">
              <summary aria-label="Cài đặt chat" title="Cài đặt chat" className="flex h-9 w-11 cursor-pointer list-none items-center justify-center gap-0.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
                <Settings2 className="size-4" aria-hidden="true" />
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-full mt-2 grid w-[calc(100vw-2rem)] max-w-2xl gap-4 rounded-xl border border-outline-variant bg-surface p-4 shadow-md sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span>Mã Facebook Page</span>
                  <input value={active?.pageId || ""} disabled={Boolean(active?.turns.length)}
                    onChange={event => save(conversations.map(item => item.id === activeId ? { ...item, pageId: event.target.value } : item))}
                    placeholder="PAGE_BAKERY_DEMO" aria-describedby="page-sim-page-id-hint"
                    className="block w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" />
                  <span id="page-sim-page-id-hint" className="text-xs text-on-surface-variant">Dùng mã Page để lấy đúng flow và tài liệu đã lưu. Tạo cuộc trò chuyện mới để đổi Page.</span>
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Tài liệu bổ sung (.md hoặc .txt)</span>
                  <input type="file" accept=".md,.txt,text/markdown,text/plain" disabled={active?.mode === "erp"} onChange={event => void loadFile(event.target.files?.[0])}
                    className="block w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-xs text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" />
                  <span className="block text-xs text-on-surface-variant">{active?.mode === "erp" ? "Chạy thật chỉ dùng tài liệu đã lưu trong Kho tri thức." : documentName ? "Đang dùng: " + documentName : "Để trống để dùng tài liệu trong Kho tri thức."}</span>
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span>Quy tắc của Page</span>
                  <textarea value={active?.rule || ""} maxLength={5000} rows={3} disabled={active?.mode === "erp"}
                    onChange={event => save(conversations.map(item => item.id === activeId ? { ...item, rule: event.target.value } : item))}
                    placeholder="Ví dụ: Hỏi loại bánh, kích cỡ, ngày nhận; xin đặt cọc nếu khách mới."
                    className="block w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" />
                  <span className="text-xs text-on-surface-variant">{active?.mode === "erp" ? "Chạy thật dùng flow Page đã lưu." : "AI dùng quy tắc này khi mô phỏng phản hồi."}</span>
                </label>
              </div>
            </details>
          </div>
        </>,
        toolbarContainer,
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside aria-label="Lịch sử chat Page" className="min-w-0 border-b border-outline-variant bg-surface-container-lowest p-3 md:flex md:min-h-0 md:flex-col md:border-b-0 md:border-r">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h3 className="text-xs font-semibold text-on-surface">Lịch sử chat</h3>
            <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-medium tabular-nums text-on-surface-variant">{recentConversations.length} phiên</span>
          </div>
          <ul className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 md:min-h-0 md:flex-1 md:flex-col md:overflow-x-hidden md:overflow-y-auto">
            {recentConversations.map(item => {
              const lastTurn = item.turns[item.turns.length - 1];
              return (
                <li key={item.id} className="min-w-48 md:min-w-0">
                  <button type="button" aria-current={item.id === activeId ? "true" : undefined}
                    onClick={() => { setConversations(current => current.filter(conversation => conversation.turns.length > 0)); setActiveId(item.id); setError(""); setDraft(""); }}
                    className={cn("w-full rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary",
                      item.id === activeId ? "bg-surface-container-low text-on-surface" : "text-on-surface hover:bg-surface-container-low")}>
                    <span className="block truncate">{lastTurn?.text || ""}</span>
                  </button>
                </li>
              );
            })}
            {!recentConversations.length && (
              <li className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center text-xs text-on-surface-variant/70">
                Chưa có lịch sử chat.
              </li>
            )}
          </ul>
        </aside>

        <main aria-label="Cuộc trò chuyện đang chọn" className="flex min-h-[24rem] min-w-0 flex-col md:min-h-0">
          <ol ref={messagesRef} aria-live="polite" aria-label="Tin nhắn cuộc hội thoại" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {active?.turns.length ? active.turns.map((turn, index) => (
              <li key={index} className={cn("flex items-end gap-2", turn.role === "customer" ? "justify-end" : "justify-start")}>
                {turn.role === "bot" && <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant" aria-hidden="true"><Bot className="size-4" /></span>}
                <div className="max-w-[88%]">
                  <p className={cn("mb-1 text-xs text-on-surface-variant", turn.role === "customer" && "text-right")}>{turn.role === "customer" ? "Khách hàng" : "Trợ lý Page"}</p>
                  <div className={cn("rounded-2xl px-4 py-3 text-sm", turn.role === "customer" ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm border border-outline-variant bg-surface text-on-surface")}>
                    <p className="whitespace-pre-wrap text-pretty">{turn.text}</p>
                  </div>
                  {turn.role === "bot" && <p className="mt-1 text-xs text-on-surface-variant">
                    {turn.mode === "rule_demo" ? "Chế độ quy tắc · " : ""}{turn.stage}
                    {turn.nextStep ? " · Tiếp theo: " + turn.nextStep : ""}
                    {turn.sources?.length ? " · Nguồn: " + turn.sources.join(", ") : ""}
                  </p>}
                  {turn.role === "bot" && turn.persisted?.order && <div className="mt-2 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-xs text-on-surface">
                    <p className="font-semibold">Đã lưu hồ sơ khách và đơn thử</p>
                    <p className="mt-1">Khách: {turn.persisted.customer?.name || "Đã lưu"}{turn.persisted.customer?.phone ? ` · ${turn.persisted.customer.phone}` : ""}</p>
                    <p>Đơn: {turn.persisted.order.orderCode} · Nháp · Chưa thanh toán · {Number(turn.persisted.order.total).toLocaleString("vi-VN")}đ</p>
                  </div>}
                </div>
                {turn.role === "customer" && <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary" aria-hidden="true"><UserRound className="size-4" /></span>}
              </li>
            )) : (
              <li className="m-auto flex max-w-sm flex-col items-center gap-2 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                  <Bot className="size-5" />
                </span>
                <p className="text-sm font-medium text-on-surface">Bắt đầu mô phỏng hội thoại</p>
                <p className="text-pretty text-xs text-on-surface-variant">
                  Nhập câu hỏi như khách hàng ở ô bên dưới để kiểm tra AI trả lời theo Kho tri thức.
                </p>
              </li>
            )}
            {busy && <li role="status" className="ml-10 text-sm text-on-surface-variant">Trợ lý Page đang soạn câu trả lời…</li>}
          </ol>

          <form onSubmit={event => { event.preventDefault(); void send(); }} className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-3 py-2.5 sm:px-4">
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="page-sim-message">Nội dung tin nhắn</label>
              <textarea id="page-sim-message" value={draft} rows={1} onChange={event => setDraft(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
                placeholder="Nhập tin nhắn của khách…" aria-describedby={pageIdMissing ? "page-sim-compose-hint" : undefined}
                className="min-h-10 max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus-visible:outline-2 focus-visible:outline-primary" />
              <button type="submit" disabled={busy || !draft.trim() || (active?.mode === "erp" && !active.pageId?.trim())} aria-label={active?.mode === "erp" ? "Gửi tin vào flow ERP" : "Gửi thử"}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="size-4" aria-hidden="true" />
              </button>
            </div>
            {(active?.mode === "erp" || pageIdMissing) && (
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-on-surface-variant">
                {pageIdMissing && <p id="page-sim-compose-hint">Nhập mã Page trong cài đặt để bật gửi</p>}
                {active?.mode === "erp" && <p className="ml-auto">Lưu trong hội thoại thử · Không gửi tới khách thật</p>}
              </div>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
          </form>
        </main>
      </div>
    </section>
  );
}
