import { useEffect, useState, type FormEvent } from "react";
import { assistantService, type AssistantMemory } from "../../services/assistantService";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErpRefreshButton } from "./ErpRefreshButton";
import { cn } from "../../modules/student-management/lib/utils";

const control = "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base text-on-surface focus-visible:border-primary focus-visible:outline-none";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function AssistantMemoryManager({ enabled, conversationId, branchId }: { enabled: boolean; conversationId?: string; branchId?: string }) {
  const [items, setItems] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AssistantMemory | null>(null);
  const [sessionMemory, setSessionMemory] = useState("");
  const [sessionMemoryDraft, setSessionMemoryDraft] = useState("");
  const [sessionMemoryVersion, setSessionMemoryVersion] = useState(0);
  const [sessionMemoryLoading, setSessionMemoryLoading] = useState(false);
  const [sessionMemoryBusy, setSessionMemoryBusy] = useState(false);
  const [sessionMemoryError, setSessionMemoryError] = useState("");
  const [sessionMemoryNotice, setSessionMemoryNotice] = useState("");
  const [confirmClearSessionOpen, setConfirmClearSessionOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void assistantService.memories(controller.signal).then(value => {
      if (!controller.signal.aborted) setItems(value);
    }).catch(cause => {
      if (!controller.signal.aborted) setError((cause as Error).message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!conversationId) return;
    const controller = new AbortController();
    setSessionMemoryLoading(true);
    setSessionMemoryError("");
    void assistantService.sessionMemory(conversationId, controller.signal, branchId).then(value => {
      if (controller.signal.aborted) return;
      setSessionMemory(value.summary);
      setSessionMemoryDraft(value.summary);
      setSessionMemoryVersion(value.version);
    }).catch(cause => {
      if (!controller.signal.aborted) setSessionMemoryError((cause as Error).message);
    }).finally(() => {
      if (!controller.signal.aborted) setSessionMemoryLoading(false);
    });
    return () => controller.abort();
  }, [conversationId, branchId]);

  const refreshSessionMemory = async () => {
    if (!conversationId) return;
    setSessionMemoryLoading(true); setSessionMemoryError(""); setSessionMemoryNotice("");
    try {
      const value = await assistantService.sessionMemory(conversationId, undefined, branchId);
      setSessionMemory(value.summary); setSessionMemoryDraft(value.summary); setSessionMemoryVersion(value.version);
    } catch (cause) {
      setSessionMemoryError((cause as Error).message);
    } finally {
      setSessionMemoryLoading(false);
    }
  };

  const saveSessionMemory = async () => {
    if (!conversationId || sessionMemoryBusy || sessionMemoryLoading) return;
    setSessionMemoryBusy(true); setSessionMemoryError(""); setSessionMemoryNotice("");
    try {
      const value = await assistantService.saveSessionMemory(conversationId, sessionMemoryDraft, sessionMemoryVersion, branchId);
      setSessionMemory(value.summary); setSessionMemoryDraft(value.summary); setSessionMemoryVersion(value.version);
      setSessionMemoryNotice("Đã lưu ngữ cảnh cho phiên chat này.");
    } catch (cause) {
      setSessionMemoryError((cause as Error).message);
    } finally {
      setSessionMemoryBusy(false);
    }
  };

  const clearSessionMemory = async () => {
    if (!conversationId || sessionMemoryBusy) return;
    setSessionMemoryBusy(true); setSessionMemoryError(""); setSessionMemoryNotice("");
    try {
      const value = await assistantService.clearSessionMemory(conversationId, branchId);
      setSessionMemory(value.summary); setSessionMemoryDraft(value.summary); setSessionMemoryVersion(value.version);
      setSessionMemoryNotice("Đã xóa ngữ cảnh tóm tắt. Lịch sử tin nhắn của phiên vẫn được giữ.");
      setConfirmClearSessionOpen(false);
    } catch (cause) {
      setSessionMemoryError((cause as Error).message);
    } finally {
      setSessionMemoryBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) { setError("Nhập nội dung muốn ghi nhớ trước nhé."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (editingId) {
        const saved = await assistantService.updateMemory(editingId, draft);
        setItems(current => current.map(item => item.id === saved.id ? saved : item));
        setNotice("Đã cập nhật ghi nhớ.");
      } else {
        const result = await assistantService.createMemory(draft);
        setItems(current => [result.item, ...current.filter(item => item.id !== result.item.id)].slice(0, 50));
        setNotice(result.created ? "Đã thêm ghi nhớ." : "Ghi nhớ này đã có; nội dung được cập nhật.");
      }
      setDraft(""); setEditingId(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setBusy(true); setError("");
    try {
      await assistantService.deleteMemory(pendingDelete.id);
      setItems(current => current.filter(item => item.id !== pendingDelete.id));
      setPendingDelete(null); setNotice("Đã xóa ghi nhớ.");
      if (editingId === pendingDelete.id) { setEditingId(null); setDraft(""); }
    } catch (cause) {
      setError((cause as Error).message);
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return <section aria-labelledby="assistant-memory-title" className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-surface-container-lowest p-4 sm:p-6">
    <header className="flex items-start justify-between gap-3">
      <div>
        <h3 id="assistant-memory-title" className="text-balance text-lg font-semibold">Ghi nhớ của tôi</h3>
        <p className="mt-1 text-pretty text-sm text-on-surface/70">Tối đa 50 mục; dùng 10 mục gần nhất khi trả lời.</p>
      </div>
      <ErpRefreshButton iconOnly aria-label="Tải lại ghi nhớ" title="Tải lại" onClick={() => setReload(value => value + 1)} disabled={loading || busy} className="size-10" />
    </header>

    <p className={cn("rounded-xl border p-3 text-sm", enabled ? "border-outline-variant bg-surface-container-low text-on-surface" : "border-outline-variant bg-surface-container-low text-on-surface/70")} role="status">
      {enabled ? "Ghi nhớ đang bật." : "Ghi nhớ đang tắt. Dữ liệu vẫn được giữ."}
    </p>

    <form aria-label={editingId ? "Sửa ghi nhớ" : "Thêm ghi nhớ"} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4" onSubmit={event => void submit(event)}>
      <div className="space-y-2">
        <label htmlFor="assistant-memory-content" className="text-sm font-medium">Thông tin muốn ghi nhớ</label>
        <textarea id="assistant-memory-content" rows={3} maxLength={300} value={draft} onChange={event => setDraft(event.target.value)} aria-describedby={error ? "assistant-memory-help assistant-memory-error" : "assistant-memory-help"} className={control} placeholder="Ví dụ: Tôi thích câu trả lời ngắn gọn, có các bước rõ ràng." />
        <p id="assistant-memory-help" className="text-pretty text-sm text-on-surface/70">Tối đa 300 ký tự. Không lưu thông tin nhạy cảm.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !draft.trim()} className={cn("rounded-xl bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40", focusClass)}>{busy ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Thêm ghi nhớ"}</button>
        {editingId && <button type="button" disabled={busy} onClick={() => { setEditingId(null); setDraft(""); setError(""); setNotice(""); }} className={cn("rounded-xl border border-outline-variant px-4 py-2 text-sm disabled:opacity-40", focusClass)}>Hủy sửa</button>}
      </div>
    </form>

    {error && <p id="assistant-memory-error" role="alert" className="text-pretty text-sm text-error">{error}</p>}
    {notice && <p role="status" className="text-sm text-on-surface">{notice}</p>}
    {loading && <p role="status" className="text-sm text-on-surface/70">Đang tải ghi nhớ…</p>}
    {!loading && !error && items.length === 0 && <p className="rounded-xl border border-outline-variant p-4 text-pretty text-sm text-on-surface/70">Chưa có ghi nhớ. Nhập thông tin ở trên để thêm.</p>}
    {!loading && items.length > 0 && <ul aria-label="Danh sách ghi nhớ của tôi" className="space-y-2">
      {items.map(item => <li key={item.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-start gap-2"><p className="text-pretty text-sm text-on-surface">{item.content}</p>{item.source === "automatic" && <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant">Tự lưu</span>}</div>
        <p className="mt-2 text-xs tabular-nums text-on-surface/70">
          <time dateTime={item.updatedAt}>Cập nhật {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</time>
          {item.lastUsedAt && <> · <time dateTime={item.lastUsedAt}>Dùng gần nhất {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.lastUsedAt))}</time></>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" aria-label={`Sửa ghi nhớ: ${item.content}`} disabled={busy} onClick={() => { setEditingId(item.id); setDraft(item.content); setError(""); setNotice(""); document.getElementById("assistant-memory-content")?.focus(); }} className={cn("rounded-lg border border-outline-variant px-3 py-1.5 text-sm disabled:opacity-40", focusClass)}>Sửa</button>
          <button type="button" aria-label={`Xóa ghi nhớ: ${item.content}`} disabled={busy} onClick={() => setPendingDelete(item)} className={cn("rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-error disabled:opacity-40", focusClass)}>Xóa</button>
        </div>
      </li>)}
    </ul>}
    {!loading && items.length >= 50 && !editingId && <p className="text-sm text-on-surface/70">Bạn đã đạt giới hạn 50 ghi nhớ. Xóa một mục để thêm mục mới.</p>}

    {conversationId && <section aria-labelledby="assistant-session-memory-title" className="space-y-3 border-t border-outline-variant pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h4 id="assistant-session-memory-title" className="text-balance text-sm font-semibold">Ngữ cảnh phiên chat</h4>
          <p className="mt-1 text-pretty text-xs leading-5 text-on-surface-variant">Chỉ áp dụng cho phiên hiện tại.</p>
        </div>
        <ErpRefreshButton iconOnly aria-label="Tải lại ngữ cảnh phiên" title="Tải lại" onClick={() => void refreshSessionMemory()} disabled={sessionMemoryLoading || sessionMemoryBusy} className="size-10" />
      </header>
      <label htmlFor="assistant-session-memory-content" className="block text-sm font-medium">Tóm tắt riêng của phiên này</label>
      <textarea id="assistant-session-memory-content" rows={5} maxLength={2000} value={sessionMemoryDraft} onChange={event => setSessionMemoryDraft(event.target.value)} aria-describedby={sessionMemoryError ? "assistant-session-memory-help assistant-session-memory-error" : "assistant-session-memory-help"} disabled={sessionMemoryLoading || sessionMemoryBusy} className={cn(control, "resize-y leading-relaxed disabled:opacity-50")} placeholder="Tóm tắt sẽ xuất hiện sau khi cuộc trò chuyện đủ dài." />
      <p id="assistant-session-memory-help" className="text-pretty text-xs leading-5 text-on-surface-variant">Không nhập thông tin nhạy cảm. <span className="tabular-nums">{sessionMemoryDraft.length}/2000</span> ký tự.</p>
      {sessionMemoryLoading && <p role="status" className="text-sm text-on-surface-variant">Đang tải ngữ cảnh phiên…</p>}
      {sessionMemoryError && <p id="assistant-session-memory-error" role="alert" className="text-pretty text-sm text-error">{sessionMemoryError}</p>}
      {sessionMemoryNotice && <p role="status" className="text-pretty text-sm text-on-surface">{sessionMemoryNotice}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void saveSessionMemory()} disabled={sessionMemoryLoading || sessionMemoryBusy || sessionMemoryDraft === sessionMemory} className={cn("min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>{sessionMemoryBusy ? "Đang lưu…" : "Lưu ngữ cảnh phiên"}</button>
        <button type="button" onClick={() => setConfirmClearSessionOpen(true)} disabled={sessionMemoryLoading || sessionMemoryBusy || !sessionMemory} className={cn("min-h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Xóa ngữ cảnh phiên</button>
      </div>
    </section>}

    <ConfirmDialog isOpen={Boolean(pendingDelete)} isSubmitting={busy} title="Xóa ghi nhớ này?" description={pendingDelete?.content || "Ghi nhớ này sẽ bị xóa khỏi tài khoản của bạn."} confirmLabel="Xóa ghi nhớ" onClose={() => setPendingDelete(null)} onConfirm={remove} />
    <ConfirmDialog isOpen={confirmClearSessionOpen} isSubmitting={sessionMemoryBusy} title="Xóa ngữ cảnh tóm tắt của phiên?" description="Chỉ xóa bản tóm tắt dùng để tiếp tục phiên này. Lịch sử tin nhắn và ghi nhớ cá nhân vẫn được giữ." confirmLabel="Xóa ngữ cảnh phiên" onClose={() => setConfirmClearSessionOpen(false)} onConfirm={clearSessionMemory} />
  </section>;
}
