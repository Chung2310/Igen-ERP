import React, { useEffect, useRef, useState } from "react";
import { MODULE_LABELS, type ModuleKey } from "../../config/modules";
import { RefreshCw } from "lucide-react";
import { assistantService } from "../../services/assistantService";
import { workflowToText, type AssistantWorkflow } from "../../shared/assistant-workflow";
import { cn } from "../../modules/student-management/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const control = "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-base text-on-surface disabled:opacity-50";
const source = (workflow: AssistantWorkflow) => workflow.sourceText ?? workflowToText(workflow);

export function AssistantWorkflowEditor() {
  const [moduleFilter, setModuleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<AssistantWorkflow[]>([]);
  const [selected, setSelected] = useState<AssistantWorkflow | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<AssistantWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"analyzing" | "saving" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const analysisRef = useRef<AbortController | null>(null);
  const choose = (workflow: AssistantWorkflow | null) => { setSelected(workflow); setText(workflow ? source(workflow) : ""); setPreview(null); setError(""); setNotice(""); };
  const load = async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { const items = await assistantService.workflows(signal); if (!signal?.aborted) { setWorkflows(items); setModuleFilter(""); setSearch(""); choose(items.find(item => item.actionId.endsWith(".create")) || items[0] || null); } }
    catch (cause) { if (!signal?.aborted) setError((cause as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => { controller.abort(); analysisRef.current?.abort(); }; }, []);
  const dirty = Boolean(selected && text !== source(selected));
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const filtered = (module: string, query: string) => workflows.filter(w => (!module || w.module === module) && normalize(w.title + " " + w.description).includes(normalize(query)));
  const visibleWorkflows = filtered(moduleFilter, search);
  const filter = (module: string, query: string) => { setModuleFilter(module); setSearch(query); const items = filtered(module, query); choose(items.find(w => w.actionId === selected?.actionId) || items[0] || null); };
  const analyze = async () => {
    if (!selected || busy || !text.trim()) return;
    const controller = new AbortController(); analysisRef.current = controller;
    setBusy("analyzing"); setError(""); setNotice(""); setPreview(null);
    try { const result = await assistantService.interpretWorkflow(selected.actionId, { version: selected.version, text }, controller.signal); if (!controller.signal.aborted) setPreview(result); }
    catch (cause) { if (!controller.signal.aborted) setError((cause as Error).message); }
    finally { if (!controller.signal.aborted) setBusy(null); analysisRef.current = null; }
  };
  const save = async (reset = false) => {
    if (!selected || busy || (!reset && !preview)) return;
    setBusy("saving"); setError(""); setNotice("");
    try {
      const updated = reset ? await assistantService.resetWorkflow(selected.actionId, selected.version) : await assistantService.saveWorkflow(selected.actionId, {
        version: selected.version, sourceText: text.trim(), enabled: preview!.enabled, instructions: preview!.instructions, requireConfirmation: preview!.requireConfirmation,
        fields: preview!.fields.map(field => ({ key: field.key, required: Boolean(field.required || field.systemRequired), ...(field.defaultValue === undefined ? {} : { defaultValue: field.defaultValue }) })),
      });
      setWorkflows(current => current.map(item => item.actionId === updated.actionId ? updated : item)); choose(updated);
      setNotice(reset ? "Đã khôi phục workflow mẫu." : "Đã lưu workflow riêng của bạn."); setResetOpen(false);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(null); }
  };
  return <section aria-label="Workflow của tôi" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
    <div><h3 className="text-balance font-semibold">Viết workflow theo cách của bạn</h3><p className="mt-1 text-pretty text-sm text-on-surface/70">Mô tả thông tin cần hỏi, giá trị mặc định và khi nào cần xác nhận. Mỗi tài khoản có bản hướng dẫn riêng.</p></div>
    {loading && <p role="status" className="text-sm">Đang tải workflow…</p>}
    {notice && <p role="status" className="text-pretty text-sm">{notice}</p>}
    {!loading && !workflows.length && !error && <p className="text-pretty text-sm">Tài khoản chưa có thao tác phù hợp trong danh mục đã tích hợp. Liên hệ quản trị viên để kiểm tra quyền và phân hệ.</p>}
    {!loading && <button type="button" disabled={Boolean(busy) || dirty} onClick={() => void load()} className={cn("inline-flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-sm disabled:opacity-50", focus)}><RefreshCw className="size-4" aria-hidden="true" />Tải lại danh sách</button>}
    {!loading && workflows.length > 0 && <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium"><span>Phân hệ</span><select value={moduleFilter} disabled={Boolean(busy) || dirty} onChange={event => filter(event.target.value, search)} className={cn(control, focus)}><option value="">Tất cả phân hệ</option>{[...new Set(workflows.map(w => w.module))].map(module => <option key={module} value={module}>{MODULE_LABELS[module as ModuleKey] || module}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium"><span>Tìm workflow</span><input type="search" value={search} disabled={Boolean(busy) || dirty} onChange={event => filter(moduleFilter, event.target.value)} placeholder="Ví dụ: lớp học, công nợ, tuyển dụng" className={cn(control, focus)} /></label>
      </div>
      <p role="status" className="text-sm text-on-surface/70"><span className="tabular-nums">{visibleWorkflows.length}</span> workflow phù hợp trong <span className="tabular-nums">{workflows.length}</span> workflow đã kết nối theo quyền của bạn.</p>
      {!visibleWorkflows.length && <button type="button" onClick={() => filter("", "")} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focus)}>Xóa bộ lọc</button>}
    </div>}
    {selected && !loading && <form onSubmit={event => { event.preventDefault(); void analyze(); }} className="space-y-4">
      <label className="block space-y-1 text-sm font-medium">Thao tác
        <select value={selected.actionId} disabled={Boolean(busy) || dirty} onChange={event => choose(workflows.find(w => w.actionId === event.target.value)!)} className={cn(control, focus)}>
          {visibleWorkflows.map(workflow => <option key={workflow.actionId} value={workflow.actionId}>{workflow.title}</option>)}
        </select>
      </label>
      {dirty && <p className="text-xs text-on-surface/70">Lưu hoặc bỏ thay đổi trước khi chọn workflow khác.</p>}
      <div className="space-y-2">
        <label htmlFor="assistant-workflow-text" className="text-sm font-medium">Mô tả workflow</label>
        <textarea id="assistant-workflow-text" value={text} disabled={Boolean(busy)} maxLength={12000} rows={12} required aria-invalid={Boolean(error)} onChange={event => { setText(event.target.value); setPreview(null); setNotice(""); setError(""); }} aria-describedby={error ? "assistant-workflow-help assistant-workflow-error" : "assistant-workflow-help"} className={cn(control, "resize-y leading-relaxed", focus)} />
        <p id="assistant-workflow-help" className="text-pretty text-sm text-on-surface/70">Ví dụ: “Yêu cầu tên, email và ngày sinh. Thiếu lương thì điền 0. Hỏi email trước. Đủ thông tin thì yêu cầu xác nhận.” Bạn có thể viết lại toàn bộ mẫu theo nhu cầu.</p>
      </div>
      <details className="rounded-xl border border-outline-variant p-3 text-sm"><summary className={cn("cursor-pointer rounded font-medium", focus)}>Thông tin thao tác có thể sử dụng</summary><p className="mt-2 text-pretty">{selected.fields.map(f => `${f.label}${f.systemRequired ? " (bắt buộc hệ thống)" : ""}`).join("; ")}.</p><p className="mt-2 text-pretty text-on-surface/70">Mô tả không cấp thêm quyền hoặc tạo trường dữ liệu mới. Phần chưa hỗ trợ sẽ được báo khi phân tích.{selected.confirmationLocked ? " Thao tác này luôn cần xác nhận." : ""}</p></details>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={Boolean(busy) || !text.trim()} className={cn("rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40", focus)}>{busy === "analyzing" ? "Đang phân tích…" : "Xem cách trợ lý hiểu"}</button>
        <button type="button" disabled={Boolean(busy) || !dirty} onClick={() => choose(selected)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm disabled:opacity-40", focus)}>Bỏ thay đổi</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => setResetOpen(true)} className={cn("rounded-xl border border-outline-variant px-3 py-2 text-sm", focus)}>Khôi phục mẫu</button>
      </div>
      {busy === "analyzing" && <p role="status" className="text-sm text-on-surface/70">Đang đọc mô tả và kiểm tra quy tắc. Chưa lưu thay đổi.</p>}
      {preview && <section aria-label="Bản diễn giải workflow" className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <h4 className="text-balance text-sm font-semibold">Trợ lý sẽ áp dụng như sau</h4>
        <p className="whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed">{workflowToText(preview)}</p>
        <p className="text-pretty text-xs text-on-surface/70">Kiểm tra bản diễn giải trước khi lưu. Cài đặt “Luôn xác nhận” của trợ lý vẫn được áp dụng nếu đang bật.</p>
        <button type="button" disabled={Boolean(busy)} onClick={() => void save()} className={cn("rounded-xl bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40", focus)}>{busy === "saving" ? "Đang lưu…" : "Lưu workflow"}</button>
      </section>}
    </form>}
    {error && <p id="assistant-workflow-error" role="alert" className="whitespace-pre-wrap text-pretty text-sm text-error">{error}</p>}
    <ConfirmDialog isOpen={resetOpen} isSubmitting={busy === "saving"} title="Khôi phục workflow mẫu?" description="Mô tả và quy tắc của workflow này sẽ được thay bằng mẫu." confirmLabel="Khôi phục" onClose={() => setResetOpen(false)} onConfirm={() => save(true)} />
  </section>;
}
