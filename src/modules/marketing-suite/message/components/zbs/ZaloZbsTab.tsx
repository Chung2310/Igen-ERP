import { useEffect, useRef, useState, type ReactNode } from "react";
import { ErpRefreshButton } from "../../../../../components/common/ErpRefreshButton";
import { ErpTableHead } from "../../../../../components/common/ErpTableHead";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { TableFilterToolbar } from "../../../../../components/common/TableFilterToolbar";
import { HrPageTitle } from "../../../../../components/hr/HrPageTitle";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { cn } from "../../../../student-management/lib/utils";
import { formatAssistantTemporalValue } from "../../../../../shared/assistant-date";
import { zbsBatchLabels, zbsRowLabels, type ZbsBatch, type ZbsBatchSummary, type ZbsMapping, type ZbsMethod, type ZbsTemplate } from "../../../../../../shared/marketing-suite/zbs";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";
import { zbsService, type ZbsAccount } from "../../services/zbsService";
import { fieldInputClass, secondaryBtnClass } from "../crm/crmFormStyles";

const money = (value: number | null) => value == null ? "Chưa có đơn giá" : `${value.toLocaleString("vi-VN")} đ`;
const time = (value?: string) => value ? formatAssistantTemporalValue(value) || "—" : "—";
const templateLabels: Record<string, string> = { ENABLE: "Đã duyệt", PENDING_REVIEW: "Chờ duyệt", REJECT: "Từ chối", DISABLE: "Đã tắt", DELETE: "Đã xóa", UNAVAILABLE: "Không còn khả dụng" };
const leadFields = [
  ["customerName", "Tên khách"], ["company", "Công ty"], ["phone", "Số điện thoại"], ["email", "Email"],
  ["productOfChoice", "Sản phẩm quan tâm"], ["value", "Giá trị"], ["telecomSubscriberCode", "Mã thuê bao"],
].map(([value, label]) => ({ value, label }));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-sm text-on-surface"><span>{label}</span>{children}</label>;
}
function Rows({ batch, historyLeadId }: { batch: ZbsBatch; historyLeadId?: string }) {
  const [status, setStatus] = useState("");
  const rows = batch.rows.filter(r => (!status || r.status === status) && (!historyLeadId || r.leadId === historyLeadId));
  return <div className="space-y-3">
    <StyledSelect ariaLabel="Lọc kết quả gửi" value={status} onChange={setStatus} className="w-full sm:w-56"
      options={[{ value: "", label: "Tất cả kết quả" }, ...Object.entries(zbsRowLabels).map(([value, label]) => ({ value, label }))]} />
    <div className="overflow-x-auto rounded-xl border border-outline-variant" tabIndex={0} role="region" aria-label="Kết quả gửi từng khách">
      <table className="w-full min-w-2xl text-left text-sm">
        <ErpTableHead columns={["Khách hàng", "Người nhận", "Dữ liệu mẫu", "Kết quả", "Thời điểm"]} />
        <tbody className="divide-y divide-outline-variant">{rows.map(row => <tr key={row.id}>
          <td className="px-4 py-3 align-top">{row.name}</td>
          <td className="px-4 py-3 align-top"><span className="block text-xs text-on-surface-variant">{row.method === "uid" ? "UID" : "SĐT"}</span><span className="break-all tabular-nums">{row.recipient || "—"}</span></td>
          <td className="px-4 py-3 align-top"><dl className="space-y-1">{Object.entries(row.data).map(([key, value]) => <div key={key}><dt className="text-xs text-on-surface-variant">{key}</dt><dd className="break-words">{value || "—"}</dd></div>)}</dl></td>
          <td className="px-4 py-3 align-top"><span>{zbsRowLabels[row.status]}</span>{row.reason && <p className="mt-1 text-pretty text-xs text-on-surface-variant">{row.reason}</p>}</td>
          <td className="px-4 py-3 align-top text-xs tabular-nums">{time(row.readAt || row.deliveredAt || row.sentAt)}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-4 text-pretty text-sm text-on-surface-variant">Không có kết quả phù hợp.</p>}
    </div>
  </div>;
}
function exportBatch(batch: ZbsBatch) {
  const escape = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const lines = [["Khách hàng", "Phương thức", "Người nhận", "Kết quả", "Chi tiết", "Thời điểm"],
    ...batch.rows.map(row => [row.name, row.method === "uid" ? "UID" : "SĐT", row.recipient, zbsRowLabels[row.status], row.reason, time(row.readAt || row.deliveredAt || row.sentAt)])];
  const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.map(line => line.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `zalo-${batch.id}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ZaloZbsTab({ canManage, initialLeadIds = [], initialOaId, historyLeadId, onBackToLeads }: {
  canManage: boolean; initialLeadIds?: string[]; initialOaId?: string; historyLeadId?: string; onBackToLeads: () => void;
}) {
  const [accounts, setAccounts] = useState<ZbsAccount[]>([]);
  const [oaId, setOaId] = useState("");
  const [templates, setTemplates] = useState<ZbsTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [view, setView] = useState<"templates" | "batches" | "history">(historyLeadId ? "history" : "templates");
  const [method, setMethod] = useState<ZbsMethod>("uid");
  const [mapping, setMapping] = useState<ZbsMapping>({});
  const [name, setName] = useState("");
  const [test, setTest] = useState(false);
  const [development, setDevelopment] = useState(false);
  const [manualRecipient, setManualRecipient] = useState("");
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialLeadIds);
  const [leads, setLeads] = useState<ExtendedLeadCard[]>([]);
  const [search, setSearch] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [leadTotalPages, setLeadTotalPages] = useState(0);
  const [leadLoading, setLeadLoading] = useState(false);
  const [batches, setBatches] = useState<ZbsBatchSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [batch, setBatch] = useState<ZbsBatch>();
  const [composer, setComposer] = useState(initialLeadIds.length > 0 && !historyLeadId);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [templateSyncError, setTemplateSyncError] = useState("");
  const [notice, setNotice] = useState("");
  const [accountRetry, setAccountRetry] = useState(0);
  const [confirm, setConfirm] = useState<"send" | "cancel">();
  const [revision, setRevision] = useState(0);
  const [onlyApproved, setOnlyApproved] = useState(true);
  const templateSelection = useRef(templateId);
  const approvedFilter = useRef(onlyApproved);
  const actionBusy = useRef(busy);
  templateSelection.current = templateId;
  approvedFilter.current = onlyApproved;
  actionBusy.current = busy;
  const template = templates.find(t => t.templateId === templateId);
  const visibleTemplates = onlyApproved ? templates.filter(t => t.status === "ENABLE") : templates;

  function applyTemplateList(data: ZbsTemplate[], initial = false) {
    setTemplates(data);
    const selected = data.find(t => t.templateId === templateSelection.current);
    if (templateSelection.current && (!selected || (approvedFilter.current && selected.status !== "ENABLE"))) {
      templateSelection.current = ""; setTemplateId(""); setMapping({});
      setNotice("Mẫu đã chọn không còn khả dụng trong danh sách hiện tại. Hãy chọn lại mẫu.");
    } else if (!templateSelection.current && initial) {
      const enabled = data.filter(t => t.status === "ENABLE");
      if (enabled.length === 1) {
        templateSelection.current = enabled[0].templateId; setTemplateId(enabled[0].templateId); setMapping(enabled[0].mapping || {});
      }
    }
  }

  useEffect(() => {
    let alive = true; setLoading(true); setError("");
    zbsService.accounts().then(result => { if (alive) { setAccounts(result.data); setOaId(result.data.find(a => a.oaId === initialOaId)?.oaId || result.data[0]?.oaId || ""); } })
      .catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accountRetry]);
  useEffect(() => {
    if (!oaId) return;
    const controller = new AbortController(); setLoading(true); setError(""); setTemplateSyncError("");
    let pending = false;
    async function refresh(initial = false) {
      if (pending || (!initial && actionBusy.current)) return;
      pending = true;
      try {
        const result = canManage ? await zbsService.sync(oaId, false, controller.signal) : await zbsService.templates(oaId, controller.signal);
        if (!controller.signal.aborted) { applyTemplateList(result.data, initial); setTemplateSyncError(""); }
      } catch (e) {
        if (!controller.signal.aborted) {
          // Keep cached templates usable if the provider is temporarily unavailable.
          let hasCached = false;
          try { const cached = await zbsService.templates(oaId, controller.signal); hasCached = cached.data.length > 0; if (!controller.signal.aborted) applyTemplateList(cached.data, initial); } catch { /* Show the original sync failure below. */ }
          if (!controller.signal.aborted) setTemplateSyncError((e instanceof Error ? e.message : "Không thể đồng bộ mẫu từ Zalo.") + (hasCached ? " Đang hiển thị danh sách mẫu đã lưu." : ""));
        }
      } finally { pending = false; if (!controller.signal.aborted && initial) setLoading(false); }
    }
    void refresh(true);
    const tick = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = setInterval(tick, 5 * 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [oaId, canManage]);
  useEffect(() => {
    if (!composer || manual) return;
    let alive = true; setLeadLoading(true);
    const timer = setTimeout(() => { void crmService.getLeadPage({ page: leadPage, limit: 50, search, includeZaloUid: true }).then(result => {
      if (alive) { setLeads(result.data); setLeadTotalPages(result.totalPages); }
    }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLeadLoading(false); }); }, 200);
    return () => { alive = false; clearTimeout(timer); };
  }, [composer, manual, leadPage, search]);
  useEffect(() => {
    if (view === "templates") return;
    let alive = true;
    const refresh = () => zbsService.batches(historyLeadId ? "" : oaId, page, historyLeadId).then(result => {
      if (alive) { setBatches(result.data); setHasMore(result.hasMore); }
    }).catch(e => { if (alive) setError(e.message); });
    void refresh(); const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 10000);
    return () => { alive = false; clearInterval(timer); };
  }, [view, oaId, page, historyLeadId, revision]);
  useEffect(() => {
    if (!batch || batch.status === "draft") return;
    let alive = true; let pending = false;
    const id = batch.id;
    const timer = setInterval(() => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      void zbsService.batch(id).then(result => { if (alive) setBatch(result.data); }).catch(e => { if (alive) setError(e.message); }).finally(() => { pending = false; });
    }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [batch?.id, batch?.status === "draft"]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Không thể thực hiện thao tác."); }
    finally { setBusy(false); }
  }
  function selectTemplate(id: string) { templateSelection.current = id; setTemplateId(id); setMapping(templates.find(t => t.templateId === id)?.mapping || {}); setError(""); }
  function openComposer(isTest: boolean) { setTest(isTest); setDevelopment(isTest && method === "phone"); setManual(false); setComposer(true); setBatch(undefined); setError(""); if (isTest) setSelected([]); }
  const answerOptions = [...new Map(leads.flatMap(lead => (lead.intakeFields || []).map(field => [field.key, { value: field.key, label: field.label }] as const))).values()];
  const supported = template?.status === "ENABLE" && (method === "uid" ? template.uidSupported : template.phoneSupported);
  const eligible = batch?.rows.filter(r => r.status === "pending").length || 0;

  return <div className="h-full min-w-0 space-y-4 overflow-y-auto p-3 text-on-surface sm:p-4" aria-busy={busy || loading}>
    <div className="flex flex-wrap items-center justify-between gap-3"><HrPageTitle>Zalo ZBS</HrPageTitle>
      <button type="button" className={secondaryBtnClass} onClick={onBackToLeads}>Về danh sách Lead</button></div>
    <div className="flex flex-wrap items-center gap-2">
      {([['templates', 'Mẫu tin'], ['batches', 'Đợt gửi'], ['history', 'Lịch sử gửi']] as const).map(([key, label]) =>
        <button type="button" key={key} aria-pressed={view === key} className={cn(secondaryBtnClass, view === key && "border-primary text-primary")}
          onClick={() => { setView(key); setPage(1); }}>{label}</button>)}
    </div>
    {(error || templateSyncError) && <div role="alert" className="space-y-2 rounded-xl border border-error bg-surface-container-lowest p-3 text-sm text-on-surface"><p className="text-pretty">{error || templateSyncError}</p>
      {!accounts.length && <button type="button" className={secondaryBtnClass} disabled={loading || busy} onClick={() => setAccountRetry(r => r + 1)}>Tải lại kết nối OA</button>}</div>}
    {notice && <p role="status" className="text-pretty text-sm">{notice}</p>}
    {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải Zalo ZBS…</p>}
    {!loading && !error && !accounts.length && view === "templates" && <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-pretty">
      <p>Chưa có OA thật được kết nối. Kết nối OA tại Tích hợp Marketing để đồng bộ và thử mẫu.</p>
      <a href="/tich-hop-marketing" className={cn(secondaryBtnClass, "mt-3")}>Mở tích hợp Marketing</a>
    </div>}
    {(accounts.length > 0 || view !== "templates") && <>
      {accounts.length > 0 && !(historyLeadId && view !== "templates") && <Field label="OA gửi tin"><StyledSelect ariaLabel="OA gửi tin" value={oaId} options={accounts.map(a => ({ value: a.oaId, label: a.name }))}
        disabled={busy} onChange={id => { templateSelection.current = ""; setTemplates([]); setTemplateId(""); setMapping({}); setComposer(initialLeadIds.length > 0 && !historyLeadId); setOaId(id); setPage(1); }} className="w-full sm:w-80" /></Field>}
      {view === "templates" && <>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1"><Field label="Mẫu tin"><StyledSelect ariaLabel="Mẫu tin" value={templateId} options={visibleTemplates.map(t => ({ value: t.templateId, label: `${t.name} · #${t.templateId} · ${templateLabels[t.status] || t.status}` }))}
            onChange={selectTemplate} disabled={busy || loading} placeholder="Chọn mẫu để gửi" searchable searchPlaceholder="Tìm tên hoặc mã mẫu…" /></Field></div>
          {canManage && <ErpRefreshButton loading={busy} disabled={loading} onClick={() => void run(async () => {
            const result = await zbsService.sync(oaId); applyTemplateList(result.data); setTemplateSyncError("");
            setNotice(`Đã đồng bộ ${result.data.length} mẫu.`);
          })}>Đồng bộ mẫu</ErpRefreshButton>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyApproved} className="accent-primary" onChange={e => {
            const checked = e.target.checked; approvedFilter.current = checked; setOnlyApproved(checked);
            if (checked && template?.status !== "ENABLE") { templateSelection.current = ""; setTemplateId(""); setMapping({}); }
          }} />Chỉ mẫu đã duyệt</label>
          <span className="text-xs tabular-nums text-on-surface-variant">{visibleTemplates.length} mẫu</span>
        </div>
        {canManage && <p className="text-pretty text-xs text-on-surface-variant">Tự đồng bộ khi mở OA và mỗi 5 phút khi màn hình đang mở. Mẫu mới được duyệt sẽ xuất hiện trong danh sách.</p>}
        {!loading && visibleTemplates.length > 1 && !templateId && <p role="status" className="text-pretty text-sm">Chọn một mẫu trong ô Mẫu tin trước khi gửi thử hoặc tạo đợt gửi.</p>}
        {!loading && !templates.length && <p className="text-pretty text-sm text-on-surface-variant">Chưa có mẫu. {canManage ? "Bấm Đồng bộ mẫu để lấy các mẫu của OA và App đang kết nối." : "Nhờ người có quyền quản lý đồng bộ mẫu."}</p>}
        {!loading && templates.length > 0 && !visibleTemplates.length && <p className="text-pretty text-sm text-on-surface-variant">Chưa có mẫu đã duyệt. Bỏ chọn Chỉ mẫu đã duyệt để xem các trạng thái khác.</p>}
        {template && <>
          <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4" aria-label="Thông tin mẫu">
            <h3 className="text-balance text-sm font-medium">{template.name}</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-on-surface-variant">Trạng thái</dt><dd>{templateLabels[template.status] || template.status}</dd></div>
              <div><dt className="text-on-surface-variant">Gửi UID</dt><dd>{template.uidSupported ? money(template.priceUid) : "Chưa xác nhận hỗ trợ"}</dd></div>
              <div><dt className="text-on-surface-variant">Gửi SĐT</dt><dd>{template.phoneSupported ? money(template.pricePhone) : "Chưa xác nhận hỗ trợ"}</dd></div>
              <div><dt className="text-on-surface-variant">Đồng bộ gần nhất</dt><dd className="tabular-nums">{time(template.syncedAt)}</dd></div>
            </dl>
            <p className="text-pretty text-xs text-on-surface-variant">Mã mẫu: {template.templateId}</p>
            {template.previewUrl && <a href={template.previewUrl} target="_blank" rel="noopener noreferrer" className={secondaryBtnClass}>Xem nội dung mẫu trên Zalo ↗</a>}
            {template.buttons.length > 0 && <ul className="space-y-1 text-sm">{template.buttons.map((button, index) => <li key={index} className="break-all">{button.title}: {button.content}</li>)}</ul>}
          </section>
          {canManage && <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryBtnClass} disabled={busy} onClick={() => openComposer(true)}>Gửi thử mẫu</button>
            <button type="button" className={primaryCreateButtonClass} disabled={busy} onClick={() => openComposer(false)}>Tạo đợt gửi</button>
          </div>}
        </>}
        {composer && canManage && template && <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4" aria-label={test ? "Gửi thử mẫu" : "Tạo đợt gửi"}>
          <h3 className="text-balance text-sm font-medium">{test ? "Gửi thử mẫu" : "Tạo đợt gửi"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên lần gửi"><input className={fieldInputClass} value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder={test ? "Thử mẫu Zalo" : "Chăm sóc khách hàng"} /></Field>
            <Field label="Phương thức"><StyledSelect ariaLabel="Phương thức gửi" value={method} disabled={busy} onChange={value => { setMethod(value as ZbsMethod); setDevelopment(test && value === "phone"); }}
              options={[{ value: "uid", label: "UID — ưu tiên" }, { value: "phone", label: "SĐT — đợt gửi riêng" }]} /></Field>
          </div>
          <p className="text-pretty text-xs text-on-surface-variant">UID chỉ dùng với đúng OA. Gửi SĐT là một đợt riêng; hệ thống không tự chuyển sang SĐT khi UID lỗi.</p>
          {!supported && <p role="status" className="text-pretty text-sm text-error">Mẫu chưa được duyệt hoặc chưa xác nhận hỗ trợ phương thức đã chọn.</p>}
          {test && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={e => { setManual(e.target.checked); setSelected([]); }} className="accent-primary" />Nhập người nhận thử thủ công</label>}
          {manual ? <Field label={method === "uid" ? "UID nhận thử của OA này" : "SĐT nhận thử"}><input className={fieldInputClass} value={manualRecipient} maxLength={40} onChange={e => setManualRecipient(e.target.value)} /></Field>
            : <div className="space-y-3">
              <TableFilterToolbar search={{ value: search, onChange: value => { setSearch(value); setLeadPage(1); }, ariaLabel: "Tìm Lead nhận tin", placeholder: "Tìm tên, SĐT, thông tin đã thu thập…" }}
                actions={<><button type="button" className={secondaryBtnClass} disabled={!selected.length || busy} onClick={() => setSelected([])}>Bỏ chọn ({selected.length})</button>
                  {!test && <button type="button" className={secondaryBtnClass} disabled={leadLoading || busy || !leads.length} onClick={() => setSelected(current => [...new Set([...current, ...leads.map(l => l.id)])].slice(0, 500))}>Chọn Lead trên trang</button>}</>} />
              <div className="overflow-x-auto rounded-xl border border-outline-variant" role="region" aria-label="Chọn Lead nhận tin" tabIndex={0} aria-busy={leadLoading}>
                <table className="w-full min-w-xl text-sm"><ErpTableHead columns={["Chọn", "Khách hàng", "UID của OA", "SĐT"]} />
                  <tbody className="divide-y divide-outline-variant">{leads.map(lead => <tr key={lead.id}>
                    <td className="px-4 py-2"><input type="checkbox" aria-label={`Chọn ${lead.customerName}`} checked={selected.includes(lead.id)} disabled={busy || (!selected.includes(lead.id) && selected.length >= 500)}
                      onChange={e => setSelected(current => e.target.checked ? (test ? [lead.id] : [...current, lead.id]) : current.filter(id => id !== lead.id))} className="accent-primary" /></td>
                    <td className="px-4 py-2">{lead.customerName}</td>
                    <td className="px-4 py-2 break-all tabular-nums">{lead.zaloIdentity?.oaId === oaId ? lead.zaloIdentity.uid : "Chưa có UID của OA"}</td>
                    <td className="px-4 py-2 tabular-nums">{lead.phone || "Chưa có SĐT"}</td>
                  </tr>)}</tbody>
                </table>
                {leadLoading && <p role="status" className="p-3 text-sm">Đang tải Lead…</p>}
                {!leadLoading && !leads.length && <p className="p-3 text-sm">Không có Lead phù hợp. Thay đổi từ khóa để tìm lại.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                <button type="button" className={secondaryBtnClass} disabled={leadPage <= 1 || leadLoading} onClick={() => setLeadPage(p => p - 1)}>Trang trước</button>
                <span>Trang {leadPage}/{Math.max(1, leadTotalPages)} · Đã chọn {selected.length}/500</span>
                <button type="button" className={secondaryBtnClass} disabled={leadPage >= leadTotalPages || leadLoading} onClick={() => setLeadPage(p => p + 1)}>Trang sau</button>
              </div>
            </div>}
          <div className="space-y-3">
            <h4 className="text-balance text-sm font-medium">Dữ liệu điền vào mẫu</h4>
            {!template.params.length && <p className="text-sm text-on-surface-variant">Mẫu không có biến dữ liệu.</p>}
            {template.params.map(param => {
              const field = mapping[param.name] || { source: "lead" as const, key: "" };
              return <div key={param.name} className="grid gap-2 rounded-xl border border-outline-variant p-3 sm:grid-cols-3">
                <div className="break-all text-sm">{param.name}{param.required ? " *" : ""}<p className="text-xs text-on-surface-variant">{param.type} · tối đa {param.maxLength} ký tự</p></div>
                <StyledSelect ariaLabel={`Nguồn ${param.name}`} value={field.source} disabled={busy} onChange={source => setMapping(current => ({ ...current, [param.name]: { source: source as "lead" | "answer" | "constant", key: "" } }))}
                  options={[{ value: "lead", label: "Trường Lead" }, { value: "answer", label: "Thông tin đã thu thập" }, { value: "constant", label: "Giá trị cố định" }]} />
                {field.source === "lead" ? <StyledSelect ariaLabel={`Trường Lead cho ${param.name}`} value={field.key} options={leadFields} disabled={busy} onChange={key => setMapping(current => ({ ...current, [param.name]: { ...field, key } }))} />
                  : field.source === "answer" ? <div className="space-y-1"><input aria-label={`Khóa thông tin đã thu thập cho ${param.name}`} aria-describedby={`zbs-answer-help-${param.name}`} className={fieldInputClass} list="zbs-answer-keys" value={field.key} maxLength={100} disabled={busy} onChange={e => setMapping(current => ({ ...current, [param.name]: { ...field, key: e.target.value } }))} placeholder="Khóa trường đã thu thập" />
                    <p id={`zbs-answer-help-${param.name}`} className="text-pretty text-xs text-on-surface-variant">Chọn hoặc nhập khóa trường trong cấu hình thu thập Lead.</p></div>
                    : <input aria-label={`Giá trị cố định cho ${param.name}`} className={fieldInputClass} value={field.key} maxLength={2000} disabled={busy} onChange={e => setMapping(current => ({ ...current, [param.name]: { ...field, key: e.target.value } }))} />}
              </div>;
            })}
            <datalist id="zbs-answer-keys">{answerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist>
            <button type="button" className={secondaryBtnClass} disabled={busy} onClick={() => void run(async () => {
              await zbsService.saveMapping(oaId, templateId, mapping); setTemplates(current => current.map(t => t.templateId === templateId ? { ...t, mapping } : t)); setNotice("Đã lưu cấu hình dữ liệu mẫu.");
            })}>Lưu cấu hình dữ liệu</button>
          </div>
          {test && method === "phone" && <label className="flex items-center gap-2 text-pretty text-sm"><input type="checkbox" checked={development} onChange={e => setDevelopment(e.target.checked)} className="accent-primary" />Development — chỉ gửi tới SĐT quản trị viên OA/App</label>}
          {test && method === "uid" && <p className="text-pretty text-xs text-on-surface-variant">Gửi thử UID là tin thật và có thể phát sinh phí theo mẫu.</p>}
          {(manual ? !manualRecipient.trim() : !selected.length) && <p id="zbs-recipient-help" className="text-pretty text-sm text-on-surface-variant">{manual ? "Nhập UID hoặc SĐT nhận thử để kiểm tra mẫu." : "Chọn ít nhất một Lead để kiểm tra mẫu."}</p>}
          <div className="flex flex-wrap gap-2"><button type="button" className={primaryCreateButtonClass} aria-describedby={(manual ? !manualRecipient.trim() : !selected.length) ? "zbs-recipient-help" : undefined} disabled={busy || !supported || (manual ? !manualRecipient.trim() : !selected.length)}
            onClick={() => void run(async () => {
              const result = await zbsService.draft({ name: name.trim() || (test ? "Thử mẫu Zalo" : "Đợt gửi Zalo"), oaId, templateId, method, mapping,
                leadIds: manual ? [] : selected, test, development, ...(manual ? { manualRecipient: manualRecipient.trim() } : {}) });
              setBatch(result.data);
            })}>{busy ? "Đang kiểm tra…" : "Kiểm tra và xem trước"}</button>
            <button type="button" className={secondaryBtnClass} disabled={busy} onClick={() => setComposer(false)}>Đóng phần soạn</button></div>
        </section>}
      </>}
      {view !== "templates" && <section className="space-y-3" aria-label={view === "history" ? "Lịch sử gửi" : "Đợt gửi"}>
        {historyLeadId && <p className="text-pretty text-sm">Đang xem các lần gửi trên tất cả OA của khách đã chọn từ Lead.</p>}
        <ErpRefreshButton disabled={busy} onClick={() => setRevision(r => r + 1)} />
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest" role="region" aria-label="Danh sách đợt gửi" tabIndex={0}>
          <table className="w-full min-w-2xl text-sm"><ErpTableHead columns={["Đợt gửi", "Mẫu tin", "Phương thức", "Kết quả", "Ngày tạo"]} />
            <tbody className="divide-y divide-outline-variant">{batches.filter(b => view !== "history" || b.status !== "draft").map(b => <tr key={b.id}>
              <td className="px-4 py-3"><button type="button" className={secondaryBtnClass} onClick={() => void run(async () => { setBatch((await zbsService.batch(b.id)).data); })}>{b.name}</button>{b.test && <span className="ml-2 text-xs">Gửi thử</span>}</td>
              <td className="px-4 py-3">{b.templateName}</td><td className="px-4 py-3">{b.method === "uid" ? "UID" : "SĐT"}</td>
              <td className="px-4 py-3"><span>{zbsBatchLabels[b.status]}</span><p className="text-xs tabular-nums">{b.delivered}/{b.total} đã giao</p></td>
              <td className="px-4 py-3 tabular-nums">{time(b.createdAt)}</td>
            </tr>)}</tbody>
          </table>
          {!batches.length && <p className="p-4 text-pretty text-sm text-on-surface-variant">Chưa có đợt gửi. Chọn mẫu trong Mẫu tin để tạo đợt gửi đầu tiên.</p>}
        </div>
        <div className="flex items-center gap-2"><button type="button" className={secondaryBtnClass} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trang trước</button><span className="text-xs tabular-nums">Trang {page}</span><button type="button" className={secondaryBtnClass} disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Trang sau</button></div>
      </section>}
    </>}
    {batch && <ErpModal native title={batch.status === "draft" ? "Kiểm tra trước khi gửi" : batch.name} maxWidth="max-w-6xl" closeDisabled={busy} onClose={() => { if (!busy) { setBatch(undefined); setError(""); } }}>
      <div className="space-y-4">
        {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
        <p className="text-pretty text-sm">{batch.templateName} · {batch.method === "uid" ? "UID" : "SĐT"} · {zbsBatchLabels[batch.status]}{batch.development ? " · Development" : ""}</p>
        <p className="text-pretty text-sm tabular-nums">{batch.rows.length} người nhận · {batch.status === "draft" ? `${eligible} đủ điều kiện · ${batch.rows.length - eligible} cần bổ sung · ` : ""}Dự kiến: {money(batch.estimatedCost)}</p>
        {batch.status === "draft" && <p className="text-pretty text-xs text-on-surface-variant">Chỉ gửi các dòng đủ điều kiện. Nội dung dùng mẫu đã duyệt trên Zalo và dữ liệu từng khách bên dưới. Bản xem trước hết hạn lúc {time(batch.expiresAt)}.</p>}
        <Rows key={batch.id} batch={batch} historyLeadId={historyLeadId} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtnClass} onClick={() => exportBatch(batch)}>Xuất kết quả CSV</button>
          {canManage && batch.method === "uid" && batch.oaId === oaId && batch.templateId === templateId && batch.rows.some(r => r.suggestedMethod === "phone" && r.leadId) && <button type="button" className={secondaryBtnClass} disabled={busy} onClick={() => {
            setSelected([...new Set(batch.rows.filter(r => r.suggestedMethod === "phone" && r.leadId).map(r => r.leadId!))]);
            setName(`${batch.name} — SĐT`.slice(0, 120)); setMethod("phone"); setTest(false); setDevelopment(false); setManual(false); setComposer(true); setView("templates"); setBatch(undefined); setError("");
          }}>Soạn đợt SĐT riêng cho Lead thiếu UID</button>}
          {canManage && batch.status !== "draft" && <button type="button" className={secondaryBtnClass} disabled={busy}
            onClick={() => void run(async () => { setBatch((await zbsService.reconcile(batch.id)).data); setNotice("Đã đối soát các tin SĐT có mã tin và cập nhật xác nhận giao tin hiện có."); })}>Đối soát trạng thái</button>}
          {canManage && batch.status === "draft" && <button type="button" className={primaryCreateButtonClass} disabled={busy || eligible === 0} onClick={() => setConfirm("send")}>Xác nhận gửi {eligible} tin</button>}
          {canManage && ["queued", "running", "paused"].includes(batch.status) && <>
            <button type="button" className={secondaryBtnClass} disabled={busy} onClick={() => void run(async () => { setBatch((await zbsService.control(batch.id, batch.status === "paused" ? "resume" : "pause")).data); setRevision(r => r + 1); })}>{batch.status === "paused" ? "Tiếp tục" : "Tạm dừng phần chưa gửi"}</button>
            <button type="button" className={secondaryBtnClass} disabled={busy} onClick={() => setConfirm("cancel")}>Hủy phần chưa gửi</button>
          </>}
        </div>
        {batch.status === "queued" && <p className="text-pretty text-xs text-on-surface-variant">Đã xếp hàng. Tiến độ gửi sẽ được cập nhật tự động.</p>}
        <ConfirmDialog native appearance="erp" icon="question" isOpen={Boolean(confirm)} isSubmitting={busy} error={error}
          title={confirm === "send" ? "Xác nhận gửi mẫu Zalo" : "Hủy các tin chưa gửi?"}
          description={confirm === "send" ? `Gửi ${eligible} tin qua ${batch.method === "uid" ? "UID" : "SĐT"} theo dữ liệu đã xem trước. Dự kiến ${money(batch.estimatedCost)}. Tin đã gửi không thể thu hồi.` : "Các tin đang gửi có thể hoàn tất. Chỉ các tin chưa bắt đầu gửi được hủy."}
          confirmLabel={confirm === "send" ? "Gửi ngay" : "Hủy phần chưa gửi"} cancelLabel="Quay lại" onClose={() => { if (!busy) setConfirm(undefined); }}
          onConfirm={() => run(async () => {
            setBatch((await (confirm === "send" ? zbsService.confirm(batch.id) : zbsService.control(batch.id, "cancel"))).data);
            setConfirm(undefined); setRevision(r => r + 1);
          })} />
      </div>
    </ErpModal>}
  </div>;
}
