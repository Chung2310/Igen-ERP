import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../student-management/lib/utils";
import { legalReferenceService, type LegalDocument, type LegalHealth, type LegalReviewTask, type LegalSearchMatch, type LegalStatus } from "./legalReferenceService";

type Section = "documents" | "review" | "search";
const statusLabels: Record<LegalStatus, string> = {
  effective: "Còn hiệu lực",
  partially_effective: "Còn hiệu lực một phần",
  upcoming: "Chưa có hiệu lực",
  expired: "Hết hiệu lực",
  repealed: "Đã bị bãi bỏ",
  unknown: "Chưa xác định",
};
const jurisdictionLabels = { central: "Trung ương", ministry: "Bộ, ngành", local: "Địa phương" } as const;
const sectionLabels: Array<{ id: Section; label: string }> = [
  { id: "documents", label: "Văn bản" },
  { id: "review", label: "Rà soát" },
  { id: "search", label: "Tra cứu" },
];

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium text-on-surface"><span>{label}</span>{children}</label>;
}

const inputClass = "min-h-10 w-full min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary";

export default function LegalReferencePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("legal-reference:manage");
  const [section, setSection] = useState<Section>("documents");
  const [health, setHealth] = useState<LegalHealth | null>(null);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [reviews, setReviews] = useState<LegalReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncPageLimit, setSyncPageLimit] = useState(2);
  const [reviewDate, setReviewDate] = useState<Record<string, string>>({});
  const [reviewText, setReviewText] = useState<Record<string, string>>({});
  const [searchForm, setSearchForm] = useState({ query: "", asOf: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }), jurisdiction: "", field: "", authority: "" });
  const [searchResults, setSearchResults] = useState<LegalSearchMatch[]>([]);
  const [generatedAnswer, setGeneratedAnswer] = useState("");
  const [answering, setAnswering] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [healthResult, documentResult, reviewResult] = await Promise.all([
        legalReferenceService.health(),
        legalReferenceService.list({ q: query, jurisdiction: jurisdictionFilter, status: statusFilter }),
        legalReferenceService.reviews(),
      ]);
      setHealth(healthResult);
      setDocuments(documentResult.documents);
      setReviews(reviewResult.tasks);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không thể tải kho văn bản pháp luật.");
    } finally {
      setLoading(false);
    }
  }, [query, jurisdictionFilter, statusFilter]);

  useEffect(() => { void loadData(); }, [loadData]);

  const effectiveCount = useMemo(() => documents.filter((document) => document.status === "effective" || document.status === "partially_effective").length, [documents]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("original");
    if (!(file instanceof File) || file.size === 0) { setNotice("Chọn bản gốc PDF, Word (.docx) hoặc TXT."); return; }
    const relationSymbol = String(data.get("relatedSymbol") || "").trim();
    const relation = String(data.get("relation") || "related");
    const affectedArticles = String(data.get("affectedArticles") || "").split(",").map((value) => value.trim()).filter(Boolean);
    const fields: Record<string, string> = Object.fromEntries(["symbol", "title", "issuingAuthority", "jurisdiction", "province", "field", "issueDate", "effectiveDate", "expiryDate", "status", "sourceUrl", "sourceSystem", "sourceDocumentId", "isConsolidated"].map((key) => [key, String(data.get(key) || "")]));
    fields.relatedDocuments = relationSymbol ? JSON.stringify([{ symbol: relationSymbol, relation, affectedArticles }]) : "[]";
    setBusy(true); setNotice("");
    try {
      const result = await legalReferenceService.create(fields, file);
      setNotice((result as { document?: { reviewRequired?: boolean }; chunksCount?: number }).document?.reviewRequired
        ? "Đã lưu bản gốc. Nội dung đang chờ rà soát trước khi đưa vào tra cứu."
        : `Đã lưu văn bản và lập ${Number((result as { chunksCount?: number }).chunksCount || 0)} đoạn tra cứu.`);
      form.reset();
      setShowCreateForm(false);
      await loadData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể lưu văn bản."); }
    finally { setBusy(false); }
  }

  async function addRevision(document: LegalDocument, file?: File) {
    if (!file) return;
    setBusy(true); setNotice("");
    try {
      const result = await legalReferenceService.addRevision(document.id, document.sourceUrl, file);
      const status = (result as { status?: string }).status;
      setNotice(status === "unchanged" ? "Tệp giống phiên bản đã lưu; không tạo bản trùng." : "Đã lưu bản gốc mới và tạo yêu cầu rà soát phiên bản.");
      await loadData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể lưu phiên bản mới."); }
    finally { setBusy(false); }
  }

  async function decide(task: LegalReviewTask, decision: "approve" | "reject") {
    if (decision === "approve" && task.taskType === "version_change" && !reviewDate[task.id]) {
      setNotice("Nhập ngày bắt đầu áp dụng trước khi duyệt phiên bản mới.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      await legalReferenceService.decideReview(task.id, decision, reviewDate[task.id]);
      setNotice(decision === "approve" ? "Đã xác nhận kết quả rà soát." : "Đã từ chối phiên bản đang chờ.");
      await loadData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể lưu kết quả rà soát."); }
    finally { setBusy(false); }
  }

  async function saveReviewText(task: LegalReviewTask) {
    const text = reviewText[task.id] || "";
    setBusy(true); setNotice("");
    try {
      const result = await legalReferenceService.updateReviewText(task.id, text) as { chunksCount?: number };
      setNotice(`Đã cập nhật nội dung và lập ${Number(result.chunksCount || 0)} đoạn; tiếp tục xác nhận trong hàng rà soát.`);
      await loadData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể cập nhật nội dung trích xuất."); }
    finally { setBusy(false); }
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAnswering(false); setSearchError(""); setGeneratedAnswer(""); setSearched(true);
    try { const result = await legalReferenceService.search(searchForm); setSearchResults(result.matches); }
    catch (error) { setSearchError(error instanceof Error ? error.message : "Không thể tra cứu văn bản."); setSearchResults([]); }
    finally { setBusy(false); }
  }

  async function runAnswer() {
    setBusy(true); setAnswering(true); setSearchError(""); setGeneratedAnswer(""); setSearched(true);
    try {
      const result = await legalReferenceService.answer(searchForm);
      setGeneratedAnswer(result.answer);
      setSearchResults(result.sources);
    } catch (error) { setSearchError(error instanceof Error ? error.message : "Không thể tạo câu trả lời có trích dẫn."); setSearchResults([]); }
    finally { setBusy(false); setAnswering(false); }
  }

  async function runSync() {
    setBusy(true); setNotice("");
    try {
      const result = await legalReferenceService.sync(syncPageLimit);
      setNotice(result.message);
      await loadData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể bắt đầu đồng bộ VBPL."); }
    finally { setBusy(false); }
  }

  return <main className="min-w-0 space-y-4 p-3 text-on-surface sm:p-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant pb-3">
      <div className="min-w-0"><h1 data-typography="page-title" className="text-balance text-lg font-semibold text-on-surface">Văn bản pháp luật</h1><p className="mt-1 max-w-3xl text-pretty text-sm text-on-surface-variant">Quản lý bản gốc, lịch sử phiên bản, rà soát trích xuất và tra cứu theo ngày áp dụng.</p></div>
      <div className="flex flex-wrap items-center gap-2"><ErpRefreshButton onClick={() => void loadData()} loading={loading} />{canManage && section === "documents" && <button type="button" onClick={() => setShowCreateForm((current) => !current)} className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{showCreateForm ? "Đóng biểu mẫu" : health && !health.syncConfigured ? "Nạp tệp thủ công" : "Thêm văn bản"}</button>}</div>
    </header>

    <nav className="flex flex-wrap gap-2 border-b border-outline-variant pb-3" aria-label="Khu vực văn bản pháp luật">
      {sectionLabels.map((item) => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => setSection(item.id)} className={cn("min-h-9 rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", section === item.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low")}>{item.label}{item.id === "review" && health?.pendingReviews ? <span className="ml-2 tabular-nums">{health.pendingReviews}</span> : null}</button>)}
    </nav>

    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-sm"><p className="text-pretty">{loadError}</p><button type="button" onClick={() => void loadData()} className="min-h-9 rounded-md border border-outline-variant px-3 font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button></div>}
    {notice && <p role="status" className="rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-pretty text-sm">{notice}</p>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tình trạng kho">
      {[
        ["Văn bản trong kho", health?.documents ?? 0],
        ["Đang có hiệu lực", effectiveCount],
        ["Đoạn đã lập chỉ mục", health?.chunks ?? 0],
        ["Chờ rà soát", health?.pendingReviews ?? 0],
      ].map(([label, value]) => <article key={label} className="rounded-md border border-outline-variant bg-surface-container-lowest p-3"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-on-surface">{loading ? "—" : value}</p></article>)}
    </section>

    <aside className="rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-sm">
      <h2 className="text-balance font-semibold">Nguồn vbpl.vn</h2>
      <p role="status" className="mt-1 max-w-4xl text-pretty text-on-surface-variant">{!health?.syncConfigured
        ? canManage
          ? "Nguồn VBPL chưa kết nối; bạn vẫn có thể nạp PDF, DOCX hoặc TXT thủ công. Chưa cần tài khoản VBPL để sử dụng kho."
          : "Nguồn VBPL chưa kết nối. Người có quyền quản lý văn bản có thể nạp tệp gốc PDF, DOCX hoặc TXT thủ công."
        : health.sync?.status === "running"
          ? `Đang đồng bộ ${health.sync.documentsFound} văn bản qua ${health.sync.pagesScanned} trang. Có thể làm mới để xem tiến độ.`
          : health.sync?.status === "failed"
            ? `Lần đồng bộ gần nhất chưa hoàn tất: ${health.sync.lastError}`
            : health.sync?.lastSuccessAt
              ? `Đồng bộ gần nhất: ${dateLabel(health.sync.lastSuccessAt)} · ${health.sync.documentsAdded} văn bản mới · ${health.sync.revisionsAdded} phiên bản cần rà soát.`
              : "Dịch vụ đã cấu hình; chờ lần đồng bộ đầu tiên."}</p>
      {canManage && health?.syncConfigured && <div className="mt-2 flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-medium" htmlFor="legal-sync-page-limit">Số trang mỗi lượt<input id="legal-sync-page-limit" className={`${inputClass} w-40 tabular-nums focus-visible:outline-2 focus-visible:outline-primary`} type="number" min={1} max={100} step={1} value={syncPageLimit} aria-describedby="legal-sync-page-help" onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 100) setSyncPageLimit(value); }} /></label><button type="button" onClick={() => void runSync()} disabled={busy || health.sync?.status === "running"} className="inline-flex min-h-9 items-center rounded-md border border-outline-variant px-3 text-sm font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{health.sync?.status === "running" ? "Đang đồng bộ…" : "Đồng bộ VBPL ngay"}</button><span id="legal-sync-page-help" className="basis-full text-xs text-on-surface-variant">Tối đa 100 trang mỗi lần; tăng để nạp kho ban đầu.</span></div>}
      <a className="mt-2 inline-flex min-h-9 items-center text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary" href="https://vbpl.moj.gov.vn" target="_blank" rel="noreferrer">Mở Cơ sở dữ liệu quốc gia về pháp luật</a>
    </aside>

    {section === "documents" && <>
      {showCreateForm && canManage && <form onSubmit={(event) => void createDocument(event)} className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-4" aria-labelledby="legal-create-title">
        <div><h2 id="legal-create-title" data-typography="section-title" className="text-balance text-base font-semibold">Nạp bản gốc</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tệp gốc được lưu riêng; nội dung trích xuất phục vụ lập chỉ mục không thay thế bản gốc.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Số, ký hiệu"><input className={inputClass} name="symbol" required maxLength={120} /></Field>
          <Field label="Tên văn bản"><input className={inputClass} name="title" required maxLength={500} /></Field>
          <Field label="Cơ quan ban hành"><input className={inputClass} name="issuingAuthority" required maxLength={250} /></Field>
          <Field label="Phạm vi"><select className={inputClass} name="jurisdiction" defaultValue="central"><option value="central">Trung ương</option><option value="ministry">Bộ, ngành</option><option value="local">Địa phương</option></select></Field>
          <Field label="Tỉnh/thành (nếu là văn bản địa phương)"><input className={inputClass} name="province" maxLength={120} /></Field>
          <Field label="Lĩnh vực"><input className={inputClass} name="field" maxLength={120} /></Field>
          <Field label="Ngày ban hành"><input className={`${inputClass} tabular-nums`} type="date" name="issueDate" /></Field>
          <Field label="Ngày hiệu lực"><input className={`${inputClass} tabular-nums`} type="date" name="effectiveDate" /></Field>
          <Field label="Ngày hết hiệu lực (nếu có)"><input className={`${inputClass} tabular-nums`} type="date" name="expiryDate" /></Field>
          <Field label="Trạng thái"><select className={inputClass} name="status" defaultValue="unknown">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="URL nguồn"><input className={inputClass} type="url" name="sourceUrl" placeholder="https://vbpl.moj.gov.vn/..." /></Field>
          <Field label="Nguồn dữ liệu"><select className={inputClass} name="sourceSystem" defaultValue="uploaded"><option value="vbpl">VBPL</option><option value="uploaded">Tệp do doanh nghiệp cung cấp</option></select></Field>
          <Field label="Mã văn bản trên nguồn (nếu có)"><input className={inputClass} name="sourceDocumentId" maxLength={100} /></Field>
          <Field label="Bản gốc PDF, Word hoặc TXT"><input className={`${inputClass} py-2`} type="file" name="original" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" required /></Field>
          <Field label="Văn bản liên quan (số ký hiệu)"><input className={inputClass} name="relatedSymbol" maxLength={120} placeholder="Để trống nếu không có" /></Field>
          <Field label="Loại liên kết"><select className={inputClass} name="relation" defaultValue="related"><option value="amends">Sửa đổi, bổ sung</option><option value="consolidates">Văn bản hợp nhất</option><option value="related">Liên quan</option></select></Field>
          <Field label="Điều bị tác động (cách nhau bằng dấu phẩy)"><input className={inputClass} name="affectedArticles" maxLength={500} placeholder="Điều 2, Điều 5 khoản 1" /></Field>
        </div>
        <label className="flex min-h-9 items-center gap-2 text-sm text-on-surface"><input type="checkbox" name="isConsolidated" value="true" className="size-4 accent-primary" />Đây là văn bản hợp nhất</label>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowCreateForm(false)} className="min-h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Hủy</button><button type="submit" disabled={busy} className="min-h-9 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang nạp…" : "Lưu bản gốc"}</button></div>
      </form>}

      <section className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4" aria-labelledby="legal-documents-title">
        <div className="flex flex-wrap items-end gap-3"><div className="min-w-48 flex-1"><Field label="Tìm văn bản"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Số ký hiệu, tên hoặc cơ quan ban hành" /></Field></div><Field label="Phạm vi"><select className={inputClass} value={jurisdictionFilter} onChange={(event) => setJurisdictionFilter(event.target.value)}><option value="">Tất cả</option>{Object.entries(jurisdictionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Trạng thái"><select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
        <h2 id="legal-documents-title" data-typography="section-title" className="text-balance text-base font-semibold">Danh mục văn bản</h2>
        {loading ? <p role="status" className="py-8 text-center text-sm text-on-surface-variant">Đang tải văn bản…</p> : documents.length === 0 ? <div className="rounded-md border border-outline-variant p-6 text-center"><p className="text-pretty text-sm text-on-surface-variant">Chưa có văn bản phù hợp.</p>{canManage && <button type="button" onClick={() => setShowCreateForm(true)} className="mt-3 min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Nạp bản gốc đầu tiên</button>}</div> : <div className="overflow-x-auto rounded-md border border-outline-variant"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="bg-surface-container-low text-xs text-on-surface-variant"><tr>{["Số, ký hiệu / Tên văn bản", "Cơ quan ban hành", "Ngày hiệu lực", "Trạng thái", "Phiên bản / đoạn", "Thao tác"].map((heading) => <th key={heading} scope="col" className="px-3 py-2.5 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant">{documents.map((document) => <tr key={document.id} className="align-top hover:bg-surface-container-low"><td className="max-w-[360px] px-3 py-3"><p className="font-semibold text-on-surface">{document.symbol}</p><p className="mt-0.5 line-clamp-2 text-pretty text-on-surface-variant">{document.title}</p>{document.reviewRequired && <span className="mt-2 inline-flex rounded-sm bg-primary/10 px-2 py-1 text-xs text-primary">Cần rà soát</span>}</td><td className="max-w-56 px-3 py-3 text-pretty">{document.issuingAuthority}</td><td className="px-3 py-3 tabular-nums">{dateLabel(document.effectiveDate)}</td><td className="px-3 py-3">{statusLabels[document.status]}</td><td className="px-3 py-3 tabular-nums">{document.latestVersion ? `Bản ${document.latestVersion.versionNumber}` : "—"} · {document.chunksCount} đoạn</td><td className="px-3 py-3"><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={!document.latestVersion || busy} onClick={() => document.latestVersion && void legalReferenceService.downloadOriginal(document.latestVersion._id, `${document.symbol}-goc`).catch((error) => setNotice(error instanceof Error ? error.message : "Không thể tải bản gốc."))} className="min-h-8 rounded-md border border-outline-variant px-2 text-xs hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Tải bản gốc</button>{document.sourceUrl && <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-md border border-outline-variant px-2 text-xs text-primary hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">Nguồn</a>}{canManage && <label className="inline-flex min-h-8 cursor-pointer items-center rounded-md border border-outline-variant px-2 text-xs text-on-surface hover:bg-surface-container focus-within:outline-2 focus-within:outline-primary"><span>Thêm bản</span><span className="sr-only"> cho {document.symbol}</span><input className="sr-only" type="file" accept=".pdf,.docx,.txt" disabled={busy} aria-label={`Thêm phiên bản cho ${document.symbol}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void addRevision(document, file); event.currentTarget.value = ""; }} /></label>}</div></td></tr>)}</tbody></table></div>}
      </section>
    </>}

    {section === "review" && <section className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4" aria-labelledby="legal-review-title">
      <div><h2 id="legal-review-title" data-typography="section-title" className="text-balance text-base font-semibold">Hàng rà soát</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tài liệu không nhận diện chắc cấu trúc và phiên bản mới được giữ ngoài tra cứu cho đến khi xác nhận.</p></div>
      {loading ? <p role="status" className="py-8 text-center text-sm text-on-surface-variant">Đang tải yêu cầu…</p> : reviews.length === 0 ? <p className="rounded-md border border-outline-variant p-6 text-center text-sm text-on-surface-variant">Không có nội dung đang chờ rà soát.</p> : <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">{reviews.map((task) => <li key={task.id} className="space-y-3 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{task.document?.symbol || "Văn bản"} · Bản {task.version?.versionNumber ?? "—"}</p><p className="mt-1 text-pretty text-sm text-on-surface-variant">{task.reason}</p><p className="mt-1 text-xs text-on-surface-variant">{task.document?.title} · {dateLabel(task.createdAt)}</p>{task.details.relatedDocuments?.map((relation) => <p key={`${task.id}-${relation.symbol}`} className="mt-2 text-sm">{relation.relation === "amends" ? "Sửa đổi" : relation.relation === "consolidates" ? "Hợp nhất" : "Liên quan"}: <span className="font-medium">{relation.symbol}</span>{relation.affectedArticles.length ? ` · ${relation.affectedArticles.join(", ")}` : " · chưa xác định Điều bị tác động"}</p>)}</div><div className="flex flex-wrap items-end gap-2">{task.taskType === "version_change" && <Field label="Ngày áp dụng"><input className={`${inputClass} w-40 tabular-nums`} type="date" value={reviewDate[task.id] || ""} onChange={(event) => setReviewDate((current) => ({ ...current, [task.id]: event.target.value }))} /></Field>}{canManage && <><button type="button" disabled={busy} onClick={() => void decide(task, "reject")} className="min-h-9 rounded-md border border-outline-variant px-3 text-sm hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Từ chối</button><button type="button" disabled={busy || (task.taskType !== "amendment" && task.version?.extractionStatus !== "indexed")} onClick={() => void decide(task, "approve")} className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">Xác nhận</button></>}</div></div>
        {task.version?.extractionStatus !== "indexed" && <div className="grid gap-2"><label className="grid gap-1.5 text-sm font-medium" htmlFor={`legal-review-text-${task.id}`}>Nội dung trích xuất hoặc OCR đã kiểm tra<textarea id={`legal-review-text-${task.id}`} className={`${inputClass} min-h-40 resize-y py-2`} maxLength={500000} value={reviewText[task.id] || ""} onChange={(event) => setReviewText((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Dán toàn bộ nội dung đã kiểm tra, giữ nguyên các dòng Điều/Khoản/Điểm…" aria-describedby={`legal-review-help-${task.id}`} /><span id={`legal-review-help-${task.id}`} className="text-xs font-normal text-on-surface-variant">Bản gốc được giữ nguyên. Chỉ nội dung đã chia theo Điều mới được đưa vào tra cứu.</span></label><div className="flex flex-wrap gap-2">{task.version?.id && <button type="button" disabled={busy} onClick={() => void legalReferenceService.downloadOriginal(task.version!.id, task.version?.originalFilename || `van-ban-${task.version?.versionNumber}`).catch((error) => setNotice(error instanceof Error ? error.message : "Không thể tải bản gốc."))} className="min-h-9 rounded-md border border-outline-variant px-3 text-sm hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Tải bản gốc để đối chiếu</button>}<button type="button" disabled={busy || !reviewText[task.id]?.trim()} onClick={() => void saveReviewText(task)} className="min-h-9 rounded-md border border-outline-variant px-3 text-sm font-medium text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Cập nhật nội dung trích xuất</button></div></div>}
      </li>)}</ul>}
    </section>}

    {section === "search" && <section className="space-y-4 rounded-md border border-outline-variant bg-surface-container-lowest p-3 sm:p-4" aria-labelledby="legal-search-title">
      <div><h2 id="legal-search-title" data-typography="section-title" className="text-balance text-base font-semibold">Tra cứu theo thời điểm áp dụng</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Kết quả hiển thị đoạn Điều/Khoản/Điểm khớp và liên kết về văn bản nguồn.</p></div>
      <form onSubmit={(event) => void runSearch(event)} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Nội dung cần tra cứu"><input className={inputClass} required maxLength={500} value={searchForm.query} onChange={(event) => setSearchForm((current) => ({ ...current, query: event.target.value }))} /></Field>
        <Field label="Tra cứu tại ngày"><input className={`${inputClass} tabular-nums`} type="date" required value={searchForm.asOf} onChange={(event) => setSearchForm((current) => ({ ...current, asOf: event.target.value }))} /></Field>
        <Field label="Phạm vi"><select className={inputClass} value={searchForm.jurisdiction} onChange={(event) => setSearchForm((current) => ({ ...current, jurisdiction: event.target.value }))}><option value="">Tất cả</option>{Object.entries(jurisdictionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Lĩnh vực"><input className={inputClass} value={searchForm.field} onChange={(event) => setSearchForm((current) => ({ ...current, field: event.target.value }))} /></Field>
        <Field label="Cơ quan ban hành"><input className={inputClass} value={searchForm.authority} onChange={(event) => setSearchForm((current) => ({ ...current, authority: event.target.value }))} /></Field>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-5"><button type="submit" disabled={busy} className="min-h-9 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{busy && !answering ? "Đang tra cứu…" : "Tra cứu"}</button><button type="button" onClick={() => void runAnswer()} disabled={busy || !searchForm.query.trim()} className="min-h-9 rounded-md border border-outline-variant px-4 text-sm font-medium text-primary hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{answering ? "Đang tổng hợp…" : "Trả lời có trích dẫn"}</button></div>
      </form>
      {searchError && <p role="alert" className="rounded-md border border-outline-variant p-3 text-sm">{searchError}</p>}
      {generatedAnswer && <div role="status" aria-live="polite" className="rounded-md border border-primary/30 bg-primary/5 p-4"><h3 className="text-balance font-semibold">Trả lời theo văn bản đã rà soát</h3><p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-6">{generatedAnswer}</p><p className="mt-2 text-xs text-on-surface-variant">Ngày áp dụng được tra cứu: {dateLabel(searchForm.asOf)}. Các mã [n] trong câu trả lời tương ứng với nguồn bên dưới.</p></div>}
      {searched && !searchError && searchResults.length === 0 && <p className="rounded-md border border-outline-variant p-6 text-center text-sm text-on-surface-variant">Không tìm thấy đoạn phù hợp trong các phiên bản đã được xác nhận.</p>}
      {searchResults.length > 0 && <ol className="space-y-3">{searchResults.map((match, index) => <li key={`${match.symbol}-${match.article}-${match.clause}-${index}`} className="rounded-md border border-outline-variant p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{match.citation && <span className="mr-1 text-primary">{match.citation}</span>}{match.symbol} · {match.title}</p><p className="mt-1 text-xs text-on-surface-variant">{match.issuingAuthority}{match.field ? ` · ${match.field}` : ""} · {statusLabels[match.status]}</p></div>{match.sourceUrl && <a href={match.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-md border border-outline-variant px-2 text-xs text-primary hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">Mở văn bản nguồn</a>}</div><p className="mt-3 text-sm font-medium">{[match.chapter, match.article, match.clause && `Khoản ${match.clause}`, match.point && `Điểm ${match.point}`].filter(Boolean).join(" · ") || "Vị trí chưa xác định"}{match.versionNumber ? ` · Bản ${match.versionNumber}` : ""}</p><p className="mt-1 whitespace-pre-wrap text-pretty text-sm leading-6">{match.text}</p></li>)}</ol>}
    </section>}
  </main>;
}
